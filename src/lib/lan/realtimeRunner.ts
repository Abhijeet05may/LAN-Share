import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import net from "net";

const REALTIME_PORT = 3003;
const REALTIME_DIR = path.join(process.cwd(), "mini-services", "realtime");
const LOG_PATH = path.join(process.cwd(), "realtime.log");

const g = globalThis as unknown as {
  __lanRealtimeChild?: ChildProcess;
  __lanRealtimeRespawning?: boolean;
};

// Quick TCP probe to see if the realtime port is already serving.
function isPortLive(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(600);
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => {
      sock.destroy();
      resolve(false);
    });
    sock.connect(port, host);
  });
}

function spawnRealtime(): ChildProcess {
  const logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
  logStream.write(`\n[runner ${new Date().toISOString()}] spawning realtime service\n`);

  const child = spawn("bun", ["index.ts"], {
    cwd: REALTIME_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  child.stdout?.pipe(logStream, { end: false });
  child.stderr?.pipe(logStream, { end: false });

  child.on("exit", (code, signal) => {
    logStream.write(
      `[runner ${new Date().toISOString()}] realtime exited code=${code} signal=${signal}\n`
    );
    g.__lanRealtimeChild = undefined;
    if (!g.__lanRealtimeRespawning) {
      g.__lanRealtimeRespawning = true;
      // Respawn after a short delay; keep trying until the port comes up.
      setTimeout(function respawn() {
        g.__lanRealtimeRespawning = false;
        if (!g.__lanRealtimeChild) {
          g.__lanRealtimeChild = spawnRealtime();
        }
      }, 2500);
    }
  });

  g.__lanRealtimeChild = child;
  return child;
}

// Called from API routes to guarantee the realtime mini-service is up.
// Spawns it as a child of the (persistent) Next.js server process so it
// survives the sandbox process-reaper that targets Bash-spawned processes.
export async function ensureRealtimeRunning(): Promise<{
  status: string;
  pid?: number;
}> {
  // Already have a tracked child.
  if (g.__lanRealtimeChild && !g.__lanRealtimeChild.killed) {
    return { status: "running", pid: g.__lanRealtimeChild.pid };
  }
  // Port already in use by some instance.
  if (await isPortLive(REALTIME_PORT)) {
    return { status: "external" };
  }
  const child = spawnRealtime();
  return { status: "spawned", pid: child.pid };
}

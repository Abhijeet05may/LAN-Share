import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const devices = await db.device.findMany({
      orderBy: { lastSeen: "desc" },
    });
    return NextResponse.json({ devices });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[devices GET] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

interface PostBody {
  id: string;
  name: string;
  deviceType?: string;
  userAgent?: string;
  avatarColor?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;
    const { id, name, deviceType, userAgent, avatarColor } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const device = await db.device.upsert({
      where: { id },
      update: {
        name: name ?? undefined,
        deviceType: deviceType ?? undefined,
        userAgent: userAgent ?? undefined,
        avatarColor: avatarColor ?? undefined,
        lastSeen: new Date(),
      },
      create: {
        id,
        name: name || "Unknown Device",
        deviceType: deviceType || "desktop",
        userAgent: userAgent || "",
        avatarColor: avatarColor || "#64748b",
        lastSeen: new Date(),
      },
    });

    return NextResponse.json({ device });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[devices POST] error:", err);
    return NextResponse.json({ error }, { status: 500 });
  }
}

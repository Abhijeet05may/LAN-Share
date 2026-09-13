# LAN Share — Local Network File Sharing & Chat

A fast, no-internet-needed web app to share files and send messages between multiple devices on the same local network (WiFi/LAN). No app installs, no cloud, no accounts — just open a browser.

Works across **desktop, tablet, and mobile**, all fully responsive.

---

## ✨ Features

- 🔗 **No installation required** — any device on the network joins by opening a URL in a browser
- 📶 **Live device list** — see every connected device in real time, with online status and device type
- 📁 **File sharing** — drag & drop, send to everyone or specific devices, upload/download progress, file history
- 💬 **Messaging** — group chat for everyone, plus private 1-to-1 chat with any device
- 📱 **Fully responsive** — same great experience on phone, tablet, and desktop
- 📷 **QR code connect** — scan to join instantly instead of typing an IP address
- 🛠️ **Admin panel** (`/admin`) — manage app settings, devices, storage, and security from one place
- 🔒 **LAN-only by design** — nothing leaves your local network

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Real-time | Socket.io |
| File handling | Multer, chunked/resumable uploads |
| Frontend | React, Tailwind CSS |
| Storage | SQLite (chat history, file logs, settings) |
| Extras | `qrcode` for connect QR, `os.networkInterfaces()` for LAN IP detection |

---

## 📂 Project Structure

```
lan-share-app/
├── server/
│   ├── index.js
│   ├── routes/
│   │   ├── upload.js
│   │   ├── download.js
│   │   └── admin.js
│   ├── sockets/
│   │   ├── devices.js
│   │   └── chat.js
│   ├── utils/
│   │   └── network.js
│   └── uploads/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DeviceList.jsx
│   │   │   ├── FileShare.jsx
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── QRConnect.jsx
│   │   │   └── AdminPanel/
│   │   └── App.jsx
│   └── tailwind.config.js
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- All devices connected to the **same WiFi/LAN network**

### Installation

```bash
git clone https://github.com/<your-username>/lan-share-app.git
cd lan-share-app
npm install
```

### Running the app

```bash
npm run dev
```

On startup, the server prints your local network address and a QR code, e.g.:

```
LAN Share is running!
Local:   http://localhost:5000
Network: http://192.168.1.1:5000

Scan the QR code below on another device to connect:
[QR CODE]
```

### Connecting other devices

1. Make sure the other device is on the **same WiFi/network**.
2. Open a browser and go to the **Network** URL shown above (e.g. `http://192.168.1.1:5000`), or scan the QR code.
3. Enter a display name and start sharing files or chatting.

> If a device can't connect, check that your host machine's firewall allows incoming connections on the app's port.

---

## ⚙️ Admin Panel

Accessible at:

```
http://<host-ip>:<port>/admin
```

Login with the admin password (set on first run / in `.env`). From here you can manage:

- General settings & branding
- Network settings (port, PIN/access code, max devices)
- File sharing limits (size, allowed types, storage quota, auto-delete rules)
- Chat settings (enable/disable, retention, message limits)
- Security (rate limiting, blocked devices)
- Device management (view, rename, kick, block)
- Maintenance (clear history, delete files, reset settings, export logs)
- Live dashboard (uptime, storage usage, active connections)

---

## 🔧 Configuration

Create a `.env` file in the project root:

```env
PORT=5000
ADMIN_PASSWORD=changeme
MAX_FILE_SIZE_MB=500
ROOM_PIN=
```

---

## 🖼️ Screenshots

> Add screenshots of the chat, file sharing, and admin panel here.

```
![Chat view](./screenshots/chat.png)
![File sharing](./screenshots/files.png)
![Admin panel](./screenshots/admin.png)
```

---

## 🗺️ Roadmap

- [ ] Dark/light theme toggle
- [ ] Resumable large file transfers
- [ ] Direct device-to-device transfer (WebRTC) for faster speeds
- [ ] Mobile PWA support (installable, offline-ready shell)

---

## 🤝 Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change, then submit a pull request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

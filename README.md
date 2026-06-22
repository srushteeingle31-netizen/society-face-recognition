# 🏠 Society Guard AI — Face Recognition Entry System

<div align="center">

![Society Guard AI Banner](https://img.shields.io/badge/Society%20Guard%20AI-Face%20Recognition-blueviolet?style=for-the-badge&logo=opencv&logoColor=white)

[![Python](https://img.shields.io/badge/Python-3.x-blue?style=flat-square&logo=python)](https://python.org)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-yellow?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![face-api.js](https://img.shields.io/badge/face--api.js-Neural%20Net-orange?style=flat-square&logo=tensorflow)](https://github.com/vladmandic/face-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Backend-Zero%20Dependencies-brightgreen?style=flat-square)](server.py)

**A premium, AI-powered face recognition and entry logging system for housing societies.**  
Built entirely with native Python and client-side neural networks — no `pip install`, no `npm install` needed.

[🚀 Quick Start](#-how-to-run) · [✨ Features](#-features) · [🧱 Architecture](#-project-structure) · [📸 Screenshots](#-screenshots)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎥 **Live Gate Scanner** | Real-time webcam feed with face detection, matching & access grant/deny |
| 🔔 **Audio Alerts** | Web Audio API chime on access granted / alarm on denied |
| 📋 **Member Enrollment** | Register Residents, Visitors, Staff, or Delivery Personnel with face capture |
| 🛡️ **Admin Dashboard** | Real-time traffic stats, member directory, entry logs, snapshot viewer |
| 🗄️ **Local JSON Database** | All data stored in `database/db.json` — no cloud, full privacy |
| 🧠 **Neural Net Matching** | 128-dimension face descriptor matching via `face-api.js` (TinyFaceDetector + FaceRecognitionNet) |
| 🌑 **Dark Glassmorphism UI** | Premium dark-mode design with glassmorphic components and micro-animations |
| 🔒 **Zero External Dependencies** | Python standard library only — runs immediately after `git clone` |

---

## 🚀 How to Run

**Requirements:** Python 3.x (pre-installed on most systems)

```bash
# 1. Clone the repository
git clone https://github.com/srushteeingle31-netizen/society-face-recognition.git
cd society-face-recognition

# 2. Start the backend server
python server.py

# 3. Open in browser
#    → http://localhost:3000
```

> **Note:** On first load, the browser downloads neural network models from jsDelivr CDN and caches them locally. Subsequent loads are fully offline.

---

## 🖥️ App Pages

| Page | URL | Description |
|---|---|---|
| 🔐 Gate Scanner | `http://localhost:3000` | Live webcam entry point — recognizes registered faces |
| 📝 Registration | `http://localhost:3000/register.html` | Enroll a new member with face capture |
| 📊 Admin Panel | `http://localhost:3000/admin.html` | Dashboard with stats, logs, and member management |

---

## 🧱 Project Structure

```
society-face-recognition/
│
├── server.py                  # Zero-dependency Python HTTP + REST API server
├── download_assets.py         # Utility: download face-api models from CDN
│
├── database/
│   └── db.json                # Local flat-file database (members + entry logs)
│
└── public/                    # Client-side web app
    ├── index.html             # Gate Scanner page
    ├── register.html          # Member Enrollment page
    ├── admin.html             # Admin Dashboard page
    │
    ├── css/
    │   └── style.css          # Dark mode + glassmorphism design system
    │
    ├── js/
    │   ├── app.js             # Shared: model loader, Web Audio alerts
    │   ├── scanner.js         # Webcam loop + Euclidean distance face matcher
    │   ├── register.js        # Face landmark detection + enrollment form
    │   ├── admin.js           # Stats, member table, search, modals
    │   └── face-api.js        # Bundled @vladmandic/face-api neural network
    │
    └── models/                # Locally bundled face-api model weights
        ├── tiny_face_detector_model.*
        ├── face_landmark_68_model.*
        └── face_recognition_model.*
```

---

## 🔬 How It Works

```
                 ┌─────────────────────────────────────────┐
                 │           Browser (Client)               │
                 │                                          │
  Webcam ──────► │  face-api.js (TensorFlow.js WASM)       │
                 │  ├── TinyFaceDetector  (detect face)     │
                 │  ├── FaceLandmark68Net (68 landmarks)    │
                 │  └── FaceRecognitionNet (128-d vector)   │
                 │              │                           │
                 │  Euclidean distance match against DB     │
                 └──────────────┬──────────────────────────┘
                                │ REST API (fetch)
                 ┌──────────────▼──────────────────────────┐
                 │        server.py (Python backend)        │
                 │  GET  /api/members   → member list       │
                 │  POST /api/members   → enroll member     │
                 │  POST /api/logs      → log entry event   │
                 │  GET  /api/stats     → dashboard stats   │
                 │  DEL  /api/members/:id → remove member   │
                 └──────────────┬──────────────────────────┘
                                │
                 ┌──────────────▼──────────────────────────┐
                 │         database/db.json                 │
                 │  { "members": [...], "logs": [...] }     │
                 └─────────────────────────────────────────┘
```

---

## 🔒 Privacy & Security

- **100% Local** — no data leaves your machine. No cloud, no external APIs.
- **Webcam access** requires browser permission. Localhost is treated as a secure origin.
- **Face descriptors** (128 floats) are stored, not raw face images (photos are optional thumbnails).
- **Database** is a plain `db.json` file you can back up or wipe at any time.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 (`http.server`, `json`, `uuid`) |
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES2020) |
| AI / ML | [face-api.js](https://github.com/vladmandic/face-api) (TensorFlow.js + WASM) |
| Database | JSON flat file |
| Design | Dark glassmorphism, CSS animations, Web Audio API |

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">
Made with ❤️ for smarter, safer communities.
</div>

# 🛡️ CrisisConnect — AI-Powered Disaster Response Platform

> A real-time emergency coordination platform connecting civilians and authorities during disaster events.

![CrisisConnect](https://img.shields.io/badge/Status-Prototype-blue?style=for-the-badge)
![Tech](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20JS-orange?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Gemini%201.5%20Flash-green?style=for-the-badge)
![Maps](https://img.shields.io/badge/Maps-Leaflet.js%20%2B%20OSM-yellowgreen?style=for-the-badge)

---

## 📌 Overview

**CrisisConnect** is a dual-interface disaster management system built for hackathons and real-world prototyping. It provides:

- A **civilian-facing mobile app** for emergency alerts, SOS, and nearby resource discovery.
- An **admin command center dashboard** for live tracking, AI triage, and resource allocation.

---

## ✨ Features

### 📱 Mobile App (Civilian Interface)
| Feature | Description |
|---|---|
| 🆘 One-Tap SOS | Broadcasts GPS location and sends SMS alerts to emergency contacts |
| 🗺️ Nearby Help | Real-time map of hospitals, police stations & fire departments (30km radius) |
| 🤖 SAHAYAK AI | Gemini-powered emergency advisor chatbot |
| 📸 Incident Reporting | Photo-based disaster reporting with live map plotting |
| 🪂 Airdrop Request | Request medical kits, food, or blankets via GPS targeting |
| 📒 Emergency Contacts | Manage and alert personal emergency contacts |
| 📋 Safety Guidelines | Offline-first disaster tips (Earthquake, Flood, Fire, Cyclone, etc.) |

### 🖥️ Admin Dashboard (Authority Interface)
| Feature | Description |
|---|---|
| 🗺️ Live Crisis Map | OpenStreetMap-based live visualization of active emergencies |
| 🧠 AI Triage | Auto-prioritization of incoming alerts (High / Medium / Low) |
| 📊 Resource Allocator | Real-time tracking of medical, rescue, food & blanket supplies |
| 🚀 Strategic Dispatch | One-click emergency airdrop deployment |

---

## 🛠️ Tech Stack

```
Frontend:       HTML5, CSS3 (Glassmorphism), Vanilla JavaScript (ES6+)
AI Integration: Google Gemini API (gemini-1.5-flash)
Mapping:        Leaflet.js, OpenStreetMap, Overpass API
Icons:          FontAwesome 6
Fonts:          Outfit, Inter (Google Fonts)
```

---

## 📦 Getting Started

### Prerequisites
- Any modern web browser (Chrome, Edge, Firefox)
- Optional: Python or Node.js for local server

### Run Locally

**Option 1 — Open directly:**
```bash
# Just open index.html in your browser
start index.html
```

**Option 2 — Python server (recommended):**
```bash
cd "SOS SYSTEM"
python -m http.server 3000
# Visit: http://localhost:3000
```

**Option 3 — Node.js server:**
```bash
npx serve . -p 3000
# Visit: http://localhost:3000
```

---

## 📁 Project Structure

```
SOS SYSTEM/
├── index.html       # Main app (mobile + admin dual-interface)
├── app.js           # Core application logic
├── styles.css       # Premium glassmorphism UI styles
├── sahayak_db.js    # SAHAYAK AI knowledge base
└── README.md        # You are here
```

---

## 🚀 Deployment

### Cloudflare Pages (Recommended — Free)
1. Visit [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **Workers & Pages → Pages → Create project → Direct Upload**
3. Upload all 4 files and click **Deploy**

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## 📝 Hackathon Submission Note

Built as a fully functional prototype demonstrating a seamless flow between high-stakes civilian emergencies and administrative resource management. All features — Maps, AI, SMS alerts, offline fallback — are integrated for a real-world "Beast Mode" experience.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

---

<div align="center">
  <b>Built with ❤️ for disaster resilience</b>
</div>

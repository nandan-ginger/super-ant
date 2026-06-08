# Ginger LiveChat AI Copilot

> An AI-powered website copilot embedded via the Ginger LiveChat widget. Answers visitor questions using page content, detects sales leads, and streams responses in real time.

---

## Architecture

```
Host Website (any domain)
  └── <script> loads frontend/widget/index.js from backend
        ├── contextExtractor.js  — DOM scraping, noise removal
        └── Socket.IO client     — real-time bidirectional

Backend (Node.js + Express + Socket.IO)
  ├── /livechat/*          — serves widget JS files
  ├── /api/chat            — REST fallback
  ├── /api/leads           — leads admin endpoint
  └── /health              — readiness probe

  Services
  ├── gemini.js            — Gemini 1.5 Flash (streaming)
  ├── leadDetector.js      — intent pattern matching
  └── sessionManager.js    — in-memory session state + TTL

  RAG Pipeline
  ├── chunker.js           — sentence-aware chunking w/ overlap
  ├── embedder.js          — Gemini text-embedding-004
  ├── store.js             — in-memory cosine similarity store
  └── retriever.js         — strategy routing (direct/RAG/summarize)

  Database (PostgreSQL)
  ├── sessions             — widget sessions
  ├── messages             — chat history
  └── leads                — captured lead data
```

---

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14
- **Gemini API Key** — [get one here](https://aistudio.google.com/app/apikey)

---

## 1. PostgreSQL Setup (one-time)

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl start postgresql && sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE USER ginger WITH PASSWORD 'ginger_dev';"
sudo -u postgres psql -c "CREATE DATABASE ginger_copilot OWNER ginger;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ginger_copilot TO ginger;"
```

The migration SQL (`backend/database/migrations/001_init.sql`) runs **automatically** on first backend start.

---

## 2. Environment Setup

```bash
# From project root
cp .env.example .env
```

Edit `.env` and fill in:
```
GEMINI_API_KEY=your_key_here
# Adjust PG credentials if needed
```

---

## 3. Install Dependencies & Run

```bash
cd backend
npm install
npm run dev
```

Backend starts on **http://localhost:3001**

---

## 4. Test the Widget

Open the test page in a browser (you can use VS Code Live Server, or any static server):

```bash
cd test
npx serve .
# Open http://localhost:3000
```

Or simply open `test/index.html` directly (note: if you open as `file://`, CORS will block Socket.IO — use a local server).

---

## 5. Embed in Any Website

Replace the `livechatURL` with your backend URL:

```html
<script type="text/javascript" id="gingerlivechat">
var ginger_chat = ginger_chat || {};
ginger_chat.salesiq = {
  widgetcode: "your_widget_id",
  pageURL: window.location.href,
  domain: window.location.protocol + "//" + window.location.hostname,
  livechatURL: "http://localhost:3001",  // ← your backend
  values: {},
  ready: function () {},
};
var s = document.createElement("script");
s.src = "http://localhost:3001/livechat/index.js";
s.defer = true;
document.head.appendChild(s);
</script>
```

---

## API Reference

### Socket.IO Events

| Event (emit) | Payload | Description |
|---|---|---|
| `context_update` | `{ pageContext }` | Send page context on load |
| `chat_message` | `{ message }` | Send a user message |
| `lead_form_submit` | `{ name, email, phone, requirement, intent }` | Submit lead data |

| Event (receive) | Payload | Description |
|---|---|---|
| `chat_response` | `{ chunk, done }` | Streamed response chunk |
| `lead_detected` | `{ intent, message }` | Lead intent found |
| `lead_saved` | `{ success, leadId }` | Lead persisted |
| `context_indexed` | `{ strategy, chunkCount }` | Page indexed |
| `error` | `{ message }` | Error from backend |

### REST Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | System health |
| `POST` | `/api/chat` | None | Non-streaming chat |
| `GET` | `/api/leads` | Bearer token | List leads |

### GET /api/leads

```bash
curl -H "Authorization: Bearer changeme_secret_key" \
  "http://localhost:3001/api/leads?limit=20&intent=pricing"
```

---

## RAG Token Routing

| Page Token Count | Strategy |
|---|---|
| < 5,000 | Send full page text directly |
| 5,000 – 50,000 | Chunk → embed → retrieve top-5 chunks |
| > 50,000 | Summarize → chunk → retrieve |

---

## Project Structure

```
superant/
├── .env.example
├── README.md
├── frontend/
│   └── widget/
│       ├── index.js              # Chat UI + Socket.IO client
│       ├── contextExtractor.js   # DOM scraping
│       └── voiceHandler.js       # Voice placeholder
└── backend/
    ├── server.js                 # Entry point
    ├── package.json
    ├── config/
    │   └── index.js
    ├── utils/
    │   ├── logger.js
    │   └── tokenCounter.js
    ├── database/
    │   ├── connection.js
    │   ├── migrations/001_init.sql
    │   └── queries/
    │       ├── sessions.js
    │       ├── messages.js
    │       └── leads.js
    ├── rag/
    │   ├── chunker.js
    │   ├── embedder.js
    │   ├── store.js
    │   └── retriever.js
    ├── services/
    │   ├── gemini.js
    │   ├── leadDetector.js
    │   ├── sessionManager.js
    │   └── voiceService.js
    ├── sockets/
    │   └── chatHandler.js
    └── routes/
        ├── chat.js
        ├── leads.js
        └── health.js
```

---

## Future Roadmap

- [ ] Voice support (Google STT + TTS)
- [ ] Qdrant persistent vector store
- [ ] Multi-language support
- [ ] Analytics dashboard
- [ ] Docker deployment
- [ ] Webhook for lead notifications


# Yarn - AI-Powered Meeting Platform

An intelligent meeting platform with real-time transcription, AI assistance, and multi-user collaboration.

## Features

- 🎥 **Multi-user meetings** - Multiple participants can join from different devices using a room code
- 🎤 **Live transcription** - Automatic speech-to-text powered by Deepgram
- 🤖 **AI Assistant (Olio)** - Ask questions about meeting content in real-time
- 👥 **Real-time collaboration** - See all participants and their status
- 📝 **Meeting context** - AI maintains context of the entire conversation
- 🔗 **Easy sharing** - Simple 6-character room codes to join meetings

## Quick Start

### Prerequisites
- Node.js (v18+)
- Python 3.8+
- Deepgram API key ([Get one here](https://console.deepgram.com/))
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### 1. Start the Realtime Server (Node.js + Socket.IO)

```bash
cd server
npm install
cp .env.example .env
# Edit .env and add your DEEPGRAM_API_KEY
npm run dev
```

Server runs on `http://localhost:5174`

### 2. Start the Python Backend (AI Features)

```bash
cd server
pip install -r requirements.txt
# Make sure GEMINI_API_KEY is set in .env
python main.py
```

Backend runs on `http://localhost:8000`

### 3. Start the Frontend (React)

```bash
# From the yarn directory
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Usage

### Creating a Meeting
1. Open `http://localhost:5173`
2. Click **"Create a yarn"**
3. Enter your name
4. Start speaking - transcription happens automatically!

### Joining a Meeting
1. Get the room code from someone in the meeting
2. Click **"Join a yarn"**
3. Enter the room code and your name
4. Join the conversation!

### During the Meeting
- **Microphone button** (green) - Click to start/stop audio streaming
- **AI Assistant** - Ask questions in the right sidebar
- **Room code** - Copy button in the header to share with others
- **Live transcript** - Shows at the bottom with speaker labels

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                       Frontend (React)                  │
└─────────────┬───────────────────────────┬───────────────┘
              │                           │
        WebSocket                      HTTP API
     (Participants,                (AI Queries to
      Audio, Live                   Transcription)
      Transcription)                     │
              │                           │
              ↓                           ↓
┌──────────────────────┐        ┌─────────────────┐
│  Realtime Server     │        │ Python Backend  │
│  (Node + Socket.IO)  │        │  (FastAPI)      │
└──────────────────────┘        └─────────────────┘
              ↓                           ↓
      Audio streaming                  Gemini API
              ↓                      (AI Analysis)
    ┌──────────────┐
    │   Deepgram   │
    │  (Live STT)  │
    └──────────────┘
```

**Key Points:**
- **Socket.IO Server**: Handles real-time participants, audio streaming to Deepgram, and live transcription broadcasting
- **FastAPI Backend**: Handles AI queries using Google Gemini for intelligent meeting analysis
- **Frontend**: Connects to both servers - WebSocket for real-time features, HTTP for AI queries

## Configuration

### Realtime Server (`server/.env`)
```env
DEEPGRAM_API_KEY=your_deepgram_api_key
CLIENT_ORIGIN=http://localhost:5173
PORT=5174
```

### Python Backend (embedded in `server/main.py`)
```python
GEMINI_API_KEY = "your_gemini_api_key"
```

## Socket.IO Events

### Client → Server (Socket.IO)
- `room:join` - Join a meeting room
- `room:leave` - Leave current room
- `audio:stream` - Stream audio data for transcription

### Server → Client (Socket.IO)
- `participants:update` - Participant list updated
- `transcription:update` - New transcription segment from Deepgram
- `transcription:history` - Full transcription when joining
- `system:info` - System messages

### Client → Server (HTTP to FastAPI)
- `POST /api/demo/query-analysis` - Ask AI a question about transcript

## API Endpoints

### Python Backend
- `POST /api/demo/analyze-audio` - Analyze uploaded audio file
- `POST /api/demo/query-analysis` - Query AI about transcript
- `GET /status` - Health check

### Realtime Server
- `GET /health` - Health check

## Development

### Frontend
```bash
npm run dev       # Development server
npm run build     # Production build
npm run preview   # Preview production build
```

### Realtime Server
```bash
cd server
npm run dev       # Development with hot reload
npm run build     # TypeScript compilation
npm start         # Run compiled version
```

### Python Backend
```bash
cd server
python main.py    # Start FastAPI server
```

## Troubleshooting

**Microphone not working?**
- Check browser permissions (allow microphone access)
- Ensure you're on localhost or HTTPS
- Click the microphone button to unmute

**No transcription?**
- Verify DEEPGRAM_API_KEY is set correctly
- Check realtime server logs for errors
- Ensure microphone is active (green button)

**AI not responding?**
- Verify GEMINI_API_KEY is set
- Check Python backend logs
- Ensure there's transcript content to analyze

**Can't connect to meeting?**
- Verify all 3 servers are running
- Check console for connection errors
- Try refreshing the page

## Documentation

- [Meeting Usage Guide](./MEETING_USAGE.md) - Detailed user guide
- [Deepgram Setup](./DEEPGRAM_SETUP.md) - Deepgram integration details
- [Server README](./server/README.md) - Realtime server documentation

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Socket.IO client
- **Realtime Server**: Node.js, Express, Socket.IO, Deepgram SDK
- **AI Backend**: Python, FastAPI, Google Gemini API
- **UI Components**: shadcn/ui, Lucide icons

## License

MIT

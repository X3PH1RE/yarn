# Multi-User Meeting Guide

## Overview
Yarn now supports real-time multi-user meetings where multiple people can join from different devices using a room code. The system includes live transcription via Deepgram and AI assistance via the backend AI service.

## Features
- **Real-time multi-user meetings**: Multiple participants can join from different devices
- **Room code system**: Easy 6-character codes to share and join meetings
- **Live transcription**: Automatic speech-to-text powered by Deepgram
- **AI Assistant (Olio)**: Ask questions about the meeting in real-time
- **Participant management**: See who's in the meeting and their status
- **Audio streaming**: Microphone audio is streamed to Deepgram for transcription

## How to Use

### Starting the Servers

1. **Start the Realtime Server** (Node.js Socket.IO server):
   ```bash
   cd server
   npm install
   npm run dev
   ```
   The server will start on `http://localhost:5174`

2. **Start the Python Backend** (for AI features):
   ```bash
   cd server
   pip install -r requirements.txt
   python main.py
   ```
   The backend will start on `http://localhost:8000`

3. **Start the Frontend** (React app):
   ```bash
   npm install
   npm run dev
   ```
   The app will start on `http://localhost:5173`

### Creating a Meeting

1. Go to the Yarn homepage
2. Click **"Create a yarn"**
3. A random 6-character room code will be generated (e.g., `ABC123`)
4. Enter your name when prompted
5. You'll join the meeting room

### Joining a Meeting

1. Go to the Yarn homepage
2. Click **"Join a yarn"**
3. Enter the room code shared by the meeting host
4. Enter your name when prompted
5. You'll join the meeting room

### During the Meeting

**Microphone Control:**
- Click the **microphone button** in the control bar to start/stop audio streaming
- When active (green), your audio is being transcribed in real-time
- When muted (gray), no audio is being captured

**Viewing Participants:**
- All participants appear in the grid view
- Each participant shows their name and avatar
- The participant count is shown in the top-right header

**Live Transcription:**
- Appears in the panel at the bottom of the screen
- Shows who said what in real-time
- Powered by Deepgram's speech recognition

**AI Assistant:**
- Located in the right sidebar
- Ask Olio questions about the meeting content
- Examples:
  - "What are the main topics discussed?"
  - "Summarize the meeting so far"
  - "What action items were mentioned?"

**Room Code Sharing:**
- The room code is displayed in the header
- Click the **copy button** to copy it to clipboard
- Share it with others to invite them to join

**Leaving the Meeting:**
- Click the red **phone button** to leave
- You'll be returned to the homepage

## Technical Details

### Architecture
- **Frontend**: React + TypeScript + Socket.IO client
- **Realtime Server**: Node.js + Express + Socket.IO + Deepgram SDK
- **AI Backend**: Python FastAPI + Google Gemini API

### Audio Processing
- Audio is captured from the microphone at 16kHz sample rate
- Converted to 16-bit PCM format
- Streamed to the realtime server via Socket.IO
- Forwarded to Deepgram for live transcription

### Socket Events
- `room:join` - Join a meeting room
- `room:leave` - Leave a meeting room
- `participants:update` - Receive participant list updates
- `audio:stream` - Stream audio data
- `transcription:update` - Receive transcription updates
- `ai:question` - Ask AI a question
- `ai:answer` - Receive AI response

## Environment Setup

Make sure you have the following environment variables set:

### Realtime Server (`server/.env`):
```
DEEPGRAM_API_KEY=your_deepgram_api_key
CLIENT_ORIGIN=http://localhost:5173
```

### Python Backend (`server/.env`):
```
GEMINI_API_KEY=your_gemini_api_key
```

## Troubleshooting

**Microphone not working:**
- Check browser permissions (allow microphone access)
- Ensure you're using HTTPS or localhost
- Check console for errors

**Transcription not showing:**
- Verify Deepgram API key is set
- Check realtime server logs
- Ensure microphone is unmuted (green button)

**Can't connect to meeting:**
- Verify all 3 servers are running
- Check that ports 5173, 5174, and 8000 are not in use
- Clear browser cache and reload

**AI not responding:**
- Verify Gemini API key is set in Python backend
- Check Python backend logs
- Ensure there's transcription content to analyze

## Tips for Best Experience

1. **Use headphones** to prevent audio feedback
2. **Speak clearly** for better transcription accuracy
3. **Keep microphone button green** when speaking
4. **Share room code** via text/email for easy joining
5. **Ask AI specific questions** for better responses

## Future Enhancements
- Video streaming (WebRTC)
- Screen sharing
- Recording and playback
- Meeting notes export
- Calendar integration


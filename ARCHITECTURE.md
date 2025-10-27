# Yarn Architecture

## System Overview

Yarn is a multi-user meeting platform with three main components working together:

1. **Frontend (React + TypeScript)** - User interface
2. **Realtime Server (Node.js + Socket.IO)** - Real-time communication
3. **AI Backend (Python + FastAPI)** - Intelligent analysis

## Component Details

### 1. Frontend (Port 5173)

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tooling
- Socket.IO Client for WebSocket connections
- Tailwind CSS + shadcn/ui for styling

**Responsibilities:**
- User interface rendering
- Microphone audio capture
- WebSocket connection management
- HTTP API calls to FastAPI
- Local state management

**Key Files:**
- `src/pages/Meeting.tsx` - Main meeting component
- `src/lib/realtime.ts` - Socket.IO connection utilities
- `src/components/*` - Reusable UI components

### 2. Realtime Server (Port 5174)

**Technology Stack:**
- Node.js + Express
- Socket.IO for WebSocket
- Deepgram SDK for speech-to-text
- TypeScript

**Responsibilities:**
- Room/session management
- Participant tracking
- Audio stream processing
- Live transcription via Deepgram
- Real-time event broadcasting

**Key Files:**
- `server/src/index.ts` - Main server file
- `server/package.json` - Dependencies

**Socket.IO Events:**

**Incoming (Client → Server):**
- `room:join({ roomId, name })` - User joins a room
- `room:leave()` - User leaves room
- `audio:stream({ roomId, audioData })` - Audio chunk for transcription
- `transcription:get({ roomId })` - Request transcription history

**Outgoing (Server → Client):**
- `participants:update(Participant[])` - Updated participant list
- `transcription:update({ segment, fullTranscription })` - New transcription
- `transcription:history(TranscriptionSegment[])` - Historical transcription
- `system:info(string)` - System notifications

**Deepgram Integration:**
- Maintains WebSocket connection to Deepgram per room
- Streams PCM audio data at 16kHz
- Receives real-time transcription with speaker diarization
- Broadcasts transcription to all room participants

### 3. AI Backend (Port 8000)

**Technology Stack:**
- Python 3.8+
- FastAPI framework
- Google Gemini API (gemini-2.5-flash model)
- Pydantic for data validation

**Responsibilities:**
- Transcript analysis
- Question answering based on meeting context
- Summary generation
- AI-powered insights

**Key Files:**
- `server/main.py` - FastAPI application

**API Endpoints:**

**POST /api/demo/analyze-audio**
- Upload audio file for transcription and analysis
- Returns: Transcript + initial AI summary
- Use case: Batch processing (not used in real-time meetings)

**POST /api/demo/query-analysis**
- Body: `{ transcript_context: DemoTranscriptEntry[], user_query: string }`
- Returns: `{ analysis_result: string }`
- Use case: Real-time AI questions during meetings

**GET /status**
- Health check endpoint

## Data Flow

### Meeting Join Flow

```
1. User clicks "Create/Join Yarn"
2. Frontend navigates to /meeting/{roomId}
3. User enters their name
4. Frontend establishes Socket.IO connection
5. Frontend emits 'room:join' event
6. Server creates/retrieves room
7. Server adds participant to room
8. Server broadcasts 'participants:update' to all
9. Server sends 'transcription:history' to new user
10. User sees other participants and transcript
```

### Audio & Transcription Flow

```
1. User clicks microphone button (unmute)
2. Frontend requests microphone permission
3. Frontend captures audio via Web Audio API
4. Frontend converts audio to 16-bit PCM
5. Frontend streams audio chunks via Socket.IO
   → Event: 'audio:stream'
6. Server receives audio chunks
7. Server forwards audio to Deepgram WebSocket
8. Deepgram processes audio and returns transcript
9. Server receives transcript from Deepgram
   → Event: LiveTranscriptionEvents.Transcript
10. Server broadcasts transcript to all participants
    → Event: 'transcription:update'
11. All clients receive and display transcript
```

### AI Query Flow

```
1. User types question in AI chat
2. Frontend sends question to FastAPI backend
   → HTTP POST to /api/demo/query-analysis
3. FastAPI receives question + full transcript context
4. FastAPI formats prompt for Gemini
5. FastAPI calls Gemini API
6. Gemini analyzes transcript and generates answer
7. FastAPI returns answer to frontend
8. Frontend displays answer in chat
```

## Audio Processing Details

### Frontend Audio Capture

```typescript
// 1. Request microphone
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: { sampleRate: 16000, ... } 
});

// 2. Create audio context
const audioContext = new AudioContext({ sampleRate: 16000 });
const source = audioContext.createMediaStreamSource(stream);

// 3. Process audio in chunks
const processor = audioContext.createScriptProcessor(4096, 1, 1);
processor.onaudioprocess = (e) => {
  const audioData = e.inputBuffer.getChannelData(0);
  // Convert Float32 to Int16 PCM
  const buffer = convertToPCM(audioData);
  // Send via Socket.IO
  socket.emit('audio:stream', { roomId, audioData: buffer });
};
```

### Server Audio Forwarding

```typescript
socket.on('audio:stream', ({ roomId, audioData }) => {
  const room = rooms.get(roomId);
  if (room?.deepgramConnection) {
    // Forward directly to Deepgram WebSocket
    room.deepgramConnection.send(audioData);
  }
});
```

### Deepgram Configuration

```typescript
const connection = deepgram.listen.live({
  model: "nova-2",           // Best accuracy model
  language: "en",
  smart_format: true,        // Auto punctuation/formatting
  interim_results: true,     // Get partial results
  punctuate: true,          // Add punctuation
  diarize: true,            // Speaker separation
});
```

## State Management

### Room State (Server-side)

```typescript
type RoomState = {
  id: string;
  participants: Map<socketId, Participant>;
  transcription: TranscriptionSegment[];
  aiContext: string;
  deepgramConnection?: DeepgramConnection;
};
```

### Meeting State (Client-side)

```typescript
const [participants, setParticipants] = useState<Participant[]>([]);
const [transcription, setTranscription] = useState<TranscriptionSegment[]>([]);
const [aiChat, setAiChat] = useState<TranscriptLine[]>([]);
const [isMuted, setIsMuted] = useState(true);
const [isConnected, setIsConnected] = useState(false);
```

## Security Considerations

### Current Implementation (Development)
- CORS: Allow all origins
- No authentication
- No encryption (except HTTPS/WSS in production)
- API keys embedded in code

### Production Recommendations
1. **Authentication**
   - JWT tokens for API access
   - Socket.IO authentication middleware
   - Room access control (passwords/invites)

2. **API Key Management**
   - Use environment variables
   - Rotate keys regularly
   - Rate limiting on API endpoints

3. **Data Privacy**
   - Encrypt audio streams
   - Store transcripts securely
   - GDPR compliance for user data
   - Option to disable recording

4. **Network Security**
   - HTTPS/WSS only in production
   - CORS whitelist specific domains
   - DDoS protection
   - WebSocket rate limiting

## Scaling Considerations

### Current Limitations
- Single server instance
- In-memory storage (rooms lost on restart)
- No persistence
- Limited to one server's capacity

### Scaling Strategies

**Horizontal Scaling:**
- Redis for shared state across servers
- Socket.IO Redis adapter for pub/sub
- Load balancer for multiple instances
- Persistent database for transcripts

**Vertical Scaling:**
- Increase server resources
- Optimize audio processing
- Batch transcript updates
- Connection pooling

**Cost Optimization:**
- Deepgram usage optimization (start/stop on activity)
- Gemini API caching
- WebSocket compression
- Audio quality vs. bandwidth trade-offs

## Development Workflow

### Local Development

```bash
# Terminal 1: Frontend
cd yarn
npm run dev

# Terminal 2: Realtime Server
cd yarn/server
npm run dev

# Terminal 3: Python Backend
cd yarn/server
python main.py
```

### Testing Multiple Participants

1. Open `http://localhost:5173` in browser 1
2. Click "Create a yarn"
3. Copy the room code
4. Open `http://localhost:5173` in browser 2 (incognito/different browser)
5. Click "Join a yarn" and paste code
6. Both participants should see each other
7. Unmute and speak - both should see transcription

## Troubleshooting

### Common Issues

**Microphone not working:**
- Check browser permissions
- Ensure HTTPS or localhost
- Check console for errors
- Verify audio device is available

**No transcription:**
- Check Deepgram API key
- Verify server logs for Deepgram connection
- Ensure audio is being sent (check network tab)
- Check Deepgram account credits

**AI not responding:**
- Verify Gemini API key
- Check FastAPI logs
- Ensure transcript has content
- Check network request to FastAPI

**Participants not syncing:**
- Verify Socket.IO connection
- Check server logs
- Ensure both clients are in same room
- Clear browser cache

## Future Enhancements

1. **Video Streaming** - Add WebRTC video streams
2. **Screen Sharing** - Share screens during meetings
3. **Recording** - Save meetings for playback
4. **Persistent Storage** - Database for rooms/transcripts
5. **User Accounts** - Authentication and profiles
6. **Meeting Scheduling** - Calendar integration
7. **Analytics** - Meeting insights and reports
8. **Mobile Apps** - Native iOS/Android apps
9. **Webhooks** - Integration with other services
10. **Custom AI Models** - Fine-tuned for specific use cases


# Yarn Realtime Server

Node.js + Socket.IO server for handling real-time meeting features including:
- WebSocket connections for participants
- Audio streaming to Deepgram for live transcription
- AI question routing and responses
- Room management

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Add your Deepgram API key to `.env`:
```
DEEPGRAM_API_KEY=your_actual_key_here
```

4. Start the development server:
```bash
npm run dev
```

The server will start on port 5174 (or the port specified in your .env file).

## Socket.IO Events

### Client → Server

- `room:join` - Join a meeting room
  - Payload: `{ roomId: string, name?: string }`
  
- `room:leave` - Leave current room

- `audio:stream` - Stream audio data for transcription
  - Payload: `{ roomId: string, audioData: ArrayBuffer }`
  
- `ai:question` - Ask the AI assistant a question
  - Payload: `{ roomId: string, question: string, userId: string }`
  
- `transcription:update` - Update transcription from client
  - Payload: `{ roomId: string, transcription: TranscriptionSegment[] }`

### Server → Client

- `participants:update` - Participant list updated
  - Payload: `Participant[]`
  
- `transcription:update` - New transcription segment
  - Payload: `{ segment: TranscriptionSegment, fullTranscription: TranscriptionSegment[] }`
  
- `transcription:history` - Full transcription history when joining
  - Payload: `TranscriptionSegment[]`
  
- `ai:answer` - AI response to your question
  - Payload: `{ question: string, answer: string, timestamp: number }`
  
- `ai:question-asked` - Another participant asked AI (broadcast)
  - Payload: `{ user: string, question: string, answer: string, timestamp: number }`
  
- `system:info` - System information message
  - Payload: `string`

## Environment Variables

- `DEEPGRAM_API_KEY` - Your Deepgram API key (required)
- `CLIENT_ORIGIN` - Allowed client origins for CORS (default: all origins)
- `PORT` - Server port (default: 5174)

## Development

The server uses:
- TypeScript for type safety
- ts-node-dev for hot reloading
- Express for HTTP server
- Socket.IO for WebSocket communication
- Deepgram SDK for live transcription

## Production Build

```bash
npm run build
npm start
```


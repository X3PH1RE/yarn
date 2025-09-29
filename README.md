
# Yarn

## Realtime Backend (Socket.IO)

The project includes a Node/Express + Socket.IO server for rooms, chat, presence, and WebRTC signaling.

### Setup

1. Open a new terminal in `yarn/server`:
   - Install deps: `npm install`
   - Create `.env` by copying environment example and adjust as needed:
     - `PORT` (default `5174`)
     - `CLIENT_ORIGIN` (e.g. `http://localhost:8080`)

2. Run the server in dev:
```
npm run dev
```

3. Build & start (prod):
```
npm run build && npm start
```

### Endpoints
- `GET /health` → `{ status: "ok" }`

### Socket events
- `room:join` → `{ roomId, name? }`
- `room:leave`
- `participants:update` → `[{ socketId, name? }]` (server → clients)
- `system:info` → `string` (server → room)
- `chat:message` → `{ roomId, user, message }` (broadcasts `{ id, user, content }`)
- `chat:typing` → `{ roomId, user, typing }`
- `webrtc:offer` → `{ roomId, to, description }`
- `webrtc:answer` → `{ roomId, to, description }`
- `webrtc:ice-candidate` → `{ roomId, to, candidate }`

### Frontend integration notes
- Point your Socket.IO client to the server URL and include `roomId` when emitting.
- Use `participants:update` to render the current roster.
- For mesh calls, each client sends `offer/answer/ice` to specific peer `socketId`.

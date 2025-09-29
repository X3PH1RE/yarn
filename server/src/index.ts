import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";

type Participant = {
  socketId: string;
  name?: string;
};

type RoomState = {
  id: string;
  participants: Map<string, Participant>;
};

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") ?? true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN?.split(",") ?? true,
    credentials: true,
  },
});

const rooms: Map<string, RoomState> = new Map();

function getOrCreateRoom(roomId: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = { id: roomId, participants: new Map() };
    rooms.set(roomId, room);
  }
  return room;
}

function emitParticipants(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  const participants = Array.from(room.participants.values()).map((p) => ({
    socketId: p.socketId,
    name: p.name ?? undefined,
  }));
  io.to(roomId).emit("participants:update", participants);
}

io.on("connection", (socket: Socket) => {
  let joinedRoomId: string | null = null;

  socket.on("room:join", ({ roomId, name }: { roomId: string; name?: string }) => {
    if (!roomId) return;
    joinedRoomId = roomId;
    const room = getOrCreateRoom(roomId);
    room.participants.set(socket.id, { socketId: socket.id, name });
    socket.join(roomId);
    socket.to(roomId).emit("system:info", `${name ?? "Someone"} joined`);
    emitParticipants(roomId);
  });

  socket.on("room:leave", () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (room) {
      room.participants.delete(socket.id);
      socket.leave(joinedRoomId);
      socket.to(joinedRoomId).emit("system:info", `A participant left`);
      emitParticipants(joinedRoomId);
      if (room.participants.size === 0) rooms.delete(joinedRoomId);
    }
    joinedRoomId = null;
  });

  socket.on("chat:message", ({ roomId, user, message }: { roomId: string; user: string; message: string }) => {
    if (!roomId || !message) return;
    io.to(roomId).emit("chat:message", { id: Date.now(), user, content: message });
  });

  socket.on("chat:typing", ({ roomId, user, typing }: { roomId: string; user: string; typing: boolean }) => {
    if (!roomId) return;
    socket.to(roomId).emit("chat:typing", { user, typing });
  });

  // WebRTC signaling
  socket.on("webrtc:offer", ({ roomId, to, description }: { roomId: string; to: string; description: any }) => {
    if (!roomId || !to) return;
    io.to(to).emit("webrtc:offer", { from: socket.id, description });
  });

  socket.on("webrtc:answer", ({ roomId, to, description }: { roomId: string; to: string; description: any }) => {
    if (!roomId || !to) return;
    io.to(to).emit("webrtc:answer", { from: socket.id, description });
  });

  socket.on("webrtc:ice-candidate", ({ roomId, to, candidate }: { roomId: string; to: string; candidate: any }) => {
    if (!roomId || !to) return;
    io.to(to).emit("webrtc:ice-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (room) {
      room.participants.delete(socket.id);
      socket.to(joinedRoomId).emit("system:info", `A participant disconnected`);
      emitParticipants(joinedRoomId);
      if (room.participants.size === 0) rooms.delete(joinedRoomId);
    }
  });
});

const PORT = Number(process.env.PORT ?? 5174);
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[realtime] listening on :${PORT}`);
});



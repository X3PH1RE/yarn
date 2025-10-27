import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import cors from "cors";
import { Server, Socket } from "socket.io";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

type Participant = {
  socketId: string;
  name?: string;
};

type TranscriptionSegment = {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
  confidence: number;
};

type RoomState = {
  id: string;
  participants: Map<string, Participant>;
  transcription: TranscriptionSegment[];
  aiContext: string;
  deepgramConnection?: any;
};

// Initialize Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || "4432edb94e886e662ed114a66c346218dac56ff0");

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
    room = { 
      id: roomId, 
      participants: new Map(),
      transcription: [],
      aiContext: ""
    };
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

// Deepgram transcription functions
function startTranscription(roomId: string) {
  const room = rooms.get(roomId);
  if (!room || room.deepgramConnection) return;

  const connection = deepgram.listen.live({
    model: "nova-2",
    language: "en",
    smart_format: true,
    interim_results: true,
    punctuate: true,
    diarize: true,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log(`🎤 Deepgram connection opened for room ${roomId}`);
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    console.log('🎤 Deepgram results:', data);
    const result = data.channel?.alternatives?.[0];
    if (result && result.transcript) {
      const segment: TranscriptionSegment = {
        id: uuidv4(),
        speaker: result.words?.[0]?.speaker || "Unknown",
        text: result.transcript,
        timestamp: Date.now(),
        confidence: result.confidence || 0,
      };

      console.log('🎤 New transcription segment:', segment);
      room.transcription.push(segment);
      
      // Transcription stored for history
      
      // Emit transcription to all participants
      io.to(roomId).emit("transcription:update", {
        segment,
        fullTranscription: room.transcription
      });
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error(`Deepgram error for room ${roomId}:`, error);
  });

  room.deepgramConnection = connection;
}

function stopTranscription(roomId: string) {
  const room = rooms.get(roomId);
  if (room?.deepgramConnection) {
    room.deepgramConnection.finish();
    room.deepgramConnection = undefined;
  }
}

// Note: AI queries are now handled by the FastAPI backend
// This server only handles real-time features: participants, audio streaming, and transcription

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
    
    // Start transcription if this is the first participant
    if (room.participants.size === 1) {
      console.log('🎤 Starting transcription for first participant in room', roomId);
      startTranscription(roomId);
    } else {
      console.log('🎤 Room already has participants, not starting new transcription');
    }
    
    // Send existing transcription to new participant
    socket.emit("transcription:history", room.transcription);
  });

  socket.on("room:leave", () => {
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (room) {
      room.participants.delete(socket.id);
      socket.leave(joinedRoomId);
      socket.to(joinedRoomId).emit("system:info", `A participant left`);
      emitParticipants(joinedRoomId);
      
      // Stop transcription if no participants left
      if (room.participants.size === 0) {
        stopTranscription(joinedRoomId);
        rooms.delete(joinedRoomId);
      }
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

  // Audio streaming for transcription
  socket.on("audio:stream", ({ roomId, audioData }: { roomId: string; audioData: ArrayBuffer }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room?.deepgramConnection) {
      console.log('🎤 Received audio data for room', roomId, 'size:', audioData.byteLength);
      try {
        room.deepgramConnection.send(audioData);
        console.log('🎤 Audio sent to Deepgram successfully');
      } catch (error) {
        console.error('❌ Error sending to Deepgram:', error);
      }
    } else {
      console.log('⚠️ No Deepgram connection for room', roomId);
      console.log('🔧 Room exists:', !!room);
      console.log('🔧 Deepgram connection exists:', !!room?.deepgramConnection);
    }
  });

  // Get transcription history
  socket.on("transcription:get", ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      socket.emit("transcription:history", room.transcription);
    }
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



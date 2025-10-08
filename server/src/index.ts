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

type AIQuestion = {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
};

// Initialize AI services
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
const aiQuestions: Map<string, AIQuestion[]> = new Map();

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
    aiQuestions.set(roomId, []);
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

  connection.on(LiveTranscriptionEvents.Results, (data) => {
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
      
      // Update AI context with recent transcription
      updateAIContext(roomId);
      
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

function updateAIContext(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Keep only last 50 segments for context
  const recentSegments = room.transcription.slice(-50);
  room.aiContext = recentSegments
    .map(seg => `${seg.speaker}: ${seg.text}`)
    .join('\n');
}

// AI chat functions
async function processAIQuestion(roomId: string, question: string, userId: string): Promise<string> {
  const room = rooms.get(roomId);
  if (!room) return "Room not found.";

  try {
    // Use Hugging Face's free API - no billing required!
    const context = room.aiContext || "No conversation context yet";
    const prompt = `You are Olio, an AI meeting assistant. Meeting context: ${context}. User asks: ${question}. Provide a helpful, intelligent response based on the meeting content.`;

    const response = await axios.post(
      "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large",
      {
        inputs: prompt,
        parameters: {
          max_length: 200,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000
      }
    );

    let answer = response.data[0]?.generated_text || "I'm here to help with your meeting!";
    
    // Clean up the response
    if (answer.includes("User asks:")) {
      answer = answer.split("User asks:")[1] || answer;
    }
    if (answer.includes("Meeting context:")) {
      answer = answer.split("Meeting context:")[1] || answer;
    }
    
    // If response is too short or generic, provide a more intelligent response
    if (answer.length < 20) {
      answer = generateIntelligentResponse(question, context);
    }
    
    // Store the Q&A
    const qa: AIQuestion = {
      id: uuidv4(),
      question,
      answer: answer.trim(),
      timestamp: Date.now(),
    };
    
    const questions = aiQuestions.get(roomId) || [];
    questions.push(qa);
    aiQuestions.set(roomId, questions);

    return answer.trim();
  } catch (error) {
    console.error("AI processing error:", error);
    
    // Generate intelligent fallback response
    const answer = generateIntelligentResponse(question, room.aiContext || "");
    
    // Store the Q&A
    const qa: AIQuestion = {
      id: uuidv4(),
      question,
      answer,
      timestamp: Date.now(),
    };
    
    const questions = aiQuestions.get(roomId) || [];
    questions.push(qa);
    aiQuestions.set(roomId, questions);

    return answer;
  }
}

// Intelligent fallback response generator
function generateIntelligentResponse(question: string, context: string): string {
  const questionLower = question.toLowerCase();
  
  if (questionLower.includes("what") && (questionLower.includes("happening") || questionLower.includes("discussed"))) {
    if (context.trim()) {
      const recentSegments = context.split('\n').slice(-5);
      return `Based on the recent conversation, here's what's happening:\n\n${recentSegments.join('\n')}\n\nThis covers the main topics being discussed in your meeting.`;
    } else {
      return "I don't have any conversation context yet. Start speaking and I'll be able to tell you what's happening in the meeting!";
    }
  } else if (questionLower.includes("summarize") || questionLower.includes("summary")) {
    if (context.trim()) {
      const segments = context.split('\n').filter(seg => seg.trim());
      const topics = segments.slice(0, 8);
      return `Here's a summary of the meeting so far:\n\n${topics.map(seg => `• ${seg}`).join('\n')}\n\nThis covers the main topics and decisions discussed.`;
    } else {
      return "I don't have enough conversation content to summarize yet. Keep talking and I'll provide a comprehensive summary!";
    }
  } else if (questionLower.includes("action") || questionLower.includes("todo") || questionLower.includes("next")) {
    if (context.trim()) {
      const segments = context.split('\n').filter(seg => seg.trim());
      return `Based on our meeting discussion, here are the key action items:\n\n${segments.map(seg => `• ${seg}`).join('\n')}\n\n**Suggested Next Steps:**\n• Review the discussion points\n• Follow up on any commitments made\n• Schedule follow-up meetings if needed`;
    } else {
      return "I don't have enough meeting content to identify action items yet. Add some meeting content first!";
    }
  } else if (questionLower.includes("email") || questionLower.includes("draft")) {
    if (context.trim()) {
      const segments = context.split('\n').filter(seg => seg.trim());
      const keyPoints = segments.slice(-6);
      return `I'll help you draft an email based on our meeting. Here are the key points:\n\n${keyPoints.map(seg => `• ${seg}`).join('\n')}\n\n**Suggested Email Structure:**\n\nSubject: Follow-up on Meeting Discussion\n\nHi [Recipient],\n\nI wanted to follow up on our meeting today. Here are the key points we discussed:\n\n${keyPoints.map(seg => `• ${seg}`).join('\n')}\n\nNext steps:\n• [Add specific action items]\n• [Add deadlines if mentioned]\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your name]`;
    } else {
      return "I don't have enough meeting content to draft an email yet. Add some meeting content first!";
    }
  } else if (questionLower.includes("hi") || questionLower.includes("hello")) {
    return `Hello! I'm Olio, your AI meeting assistant. I'm listening to your conversation and ready to help. ${context.trim() ? 'I can see we have some discussion going on!' : 'Start speaking and I\'ll be able to assist you better!'}`;
  } else if (questionLower.includes("help")) {
    return `I can help you with:\n• "What's happening in the meeting?" - Get recent conversation\n• "Summarize the meeting" - Get a summary\n• "What are the action items?" - Identify tasks\n• "Draft an email" - Create email from meeting content\n• Ask specific questions about the meeting content`;
  } else {
    // General intelligent response
    if (context.trim()) {
      const recentContext = context.split('\n').slice(-3).join(' ');
      return `Based on our meeting discussion: "${recentContext}". You asked: "${question}". I'm here to help with any questions about the meeting! What specific aspect would you like to know more about?`;
    } else {
      return `You asked: "${question}". I'm Olio, your AI meeting assistant. I'm ready to help once we have some conversation to work with! Add some meeting content and ask me anything about it.`;
    }
  }
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
    
    // Start transcription if this is the first participant
    if (room.participants.size === 1) {
      console.log('🎤 Starting transcription for first participant in room', roomId);
      startTranscription(roomId);
    } else {
      console.log('🎤 Room already has participants, not starting new transcription');
    }
    
    // Send existing transcription and AI questions to new participant
    socket.emit("transcription:history", room.transcription);
    socket.emit("ai:questions", aiQuestions.get(roomId) || []);
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
        aiQuestions.delete(joinedRoomId);
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

  // Transcription update from frontend
  socket.on("transcription:update", ({ roomId, transcription }) => {
    console.log(`📝 Received transcription update for room ${roomId}:`, transcription.length, 'segments');
    const room = rooms.get(roomId);
    if (room) {
      // Update room transcription
      room.transcription = transcription;
      // Update AI context
      updateAIContext(roomId);
      console.log(`📝 Updated AI context for room ${roomId}:`, room.aiContext?.substring(0, 100) + '...');
    }
  });

  // AI chat
  socket.on("ai:question", async ({ roomId, question, userId }: { roomId: string; question: string; userId: string }) => {
    if (!roomId || !question) return;
    
    const answer = await processAIQuestion(roomId, question, userId);
    
    // Send answer back to the asking user
    socket.emit("ai:answer", { question, answer, timestamp: Date.now() });
    
    // Broadcast to all participants in the room
    io.to(roomId).emit("ai:question-asked", { 
      user: userId, 
      question, 
      answer, 
      timestamp: Date.now() 
    });
  });

  // Get transcription history
  socket.on("transcription:get", ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      socket.emit("transcription:history", room.transcription);
    }
  });

  // Get AI questions history
  socket.on("ai:questions:get", ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    const questions = aiQuestions.get(roomId) || [];
    socket.emit("ai:questions", questions);
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



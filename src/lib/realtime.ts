import { io, Socket } from "socket.io-client";

export type ChatMessage = { id: number; user: string; content: string };
export type Participant = { socketId: string; name?: string };

export type TranscriptionSegment = {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
  confidence: number;
};

export type AIQuestion = {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
};

export type TranscriptionUpdate = {
  segment: TranscriptionSegment;
  fullTranscription: TranscriptionSegment[];
};

export type AIAnswer = {
  question: string;
  answer: string;
  timestamp: number;
};

export type AIQuestionAsked = {
  user: string;
  question: string;
  answer: string;
  timestamp: number;
};

export function createSocketConnection(serverUrl: string): Socket {
  console.log('Connecting to backend:', serverUrl);
  const socket = io(serverUrl, { 
    transports: ["websocket", "polling"], 
    withCredentials: true,
    timeout: 10000,
    forceNew: true
  });
  
  socket.on('connect', () => {
    console.log('Connected to backend:', serverUrl);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Failed to connect to backend:', error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from backend:', reason);
  });
  
  return socket;
}



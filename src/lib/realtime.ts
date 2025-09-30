import { io, Socket } from "socket.io-client";

export type ChatMessage = { id: number; user: string; content: string };
export type Participant = { socketId: string; name?: string };

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



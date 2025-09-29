import { io, Socket } from "socket.io-client";

export type ChatMessage = { id: number; user: string; content: string };
export type Participant = { socketId: string; name?: string };

export function createSocketConnection(serverUrl: string): Socket {
  const socket = io(serverUrl, { transports: ["websocket"], withCredentials: true });
  return socket;
}



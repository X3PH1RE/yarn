import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createSocketConnection, Participant } from "@/lib/realtime";
import { 
  Phone, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  Lightbulb, 
  Send,
  Settings,
  MessageCircle,
  Users,
  Volume2
} from "lucide-react";

const Meeting = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ id: number; user: string; content: string }[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [systemInfo, setSystemInfo] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const serverUrl = useMemo(() => {
    return (import.meta as any).env.VITE_SERVER_URL || "http://localhost:5174";
  }, []);
  const socket = useMemo(() => createSocketConnection(serverUrl), [serverUrl]);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("room:join", { roomId });

    const onConnect = () => setSelfId(socket.id);
    const onParticipants = (list: Participant[]) => setParticipants(list);
    const onSystem = (msg: string) => setSystemInfo(msg);
    const onChat = (payload: { id: number; user: string; content: string }) => {
      setMessages((prev) => [...prev, payload]);
    };

    socket.on("connect", onConnect);
    socket.on("participants:update", onParticipants);
    socket.on("system:info", onSystem);
    socket.on("chat:message", onChat);

    return () => {
      socket.emit("room:leave");
      socket.off("connect", onConnect);
      socket.off("participants:update", onParticipants);
      socket.off("system:info", onSystem);
      socket.off("chat:message", onChat);
      socket.disconnect();
    };
  }, [roomId, socket]);

  // Get local media on mount
  useEffect(() => {
    let isMounted = true;
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!isMounted) return;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Failed to get user media", err);
      }
    };
    startMedia();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendMessage = () => {
    if (!roomId) return;
    if (message.trim()) {
      socket.emit("chat:message", { roomId, user: "You", message });
      setMessage("");
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
      }
      return next;
    });
  };

  const handleToggleVideo = () => {
    setIsVideoOff((prev) => {
      const next = !prev;
      if (localStream) {
        localStream.getVideoTracks().forEach((t) => (t.enabled = !next));
      }
      return next;
    });
  };

  const handleEndCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    socket.emit("room:leave");
    socket.disconnect();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col p-4">
        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4 mb-4">
          {participants.map((participant) => (
            <div
              key={participant.socketId}
              className="relative bg-muted rounded-xl overflow-hidden aspect-video border-2 border-border"
            >
              {/* Video placeholder */}
              {participant.socketId === selfId ? (
                <video
                  ref={localVideoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline 
                  autoPlay
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-yarn-purple/10 to-yarn-blue/10 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-yarn-dark rounded-full flex items-center justify-center mb-2 mx-auto">
                      <span className="text-white font-bold text-xl">{(participant.name ?? participant.socketId).slice(-1)}</span>
                    </div>
                    <span className="text-sm font-medium text-yarn-text">
                      {participant.name ?? participant.socketId}
                    </span>
                  </div>
                </div>
              )}
              
              {/* User controls overlay */}
              <div className="absolute bottom-2 left-2 flex items-center space-x-2">
                {/* In a later step, bind actual mute/video states per participant */}
              </div>
            </div>
          ))}
        </div>

        {/* Control Bar */}
        <div className="flex justify-center">
          <div className="bg-white rounded-full px-4 py-3 shadow-lg border border-border flex items-center space-x-3">
            <Button
              size="sm"
              variant="destructive"
              className="rounded-full w-12 h-12 p-0"
              onClick={handleEndCall}
            >
              <Phone className="w-5 h-5" />
            </Button>
            
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              className="rounded-full w-12 h-12 p-0"
              onClick={handleToggleMute}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              size="sm"
              variant={isVideoOff ? "destructive" : "secondary"}
              className="rounded-full w-12 h-12 p-0"
              onClick={handleToggleVideo}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </Button>
            
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full w-12 h-12 p-0"
            >
              <Users className="w-5 h-5" />
            </Button>
            
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full w-12 h-12 p-0"
            >
              <Monitor className="w-5 h-5" />
            </Button>
            
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full w-12 h-12 p-0 bg-yellow-100 hover:bg-yellow-200"
            >
              <Lightbulb className="w-5 h-5 text-yellow-600" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-card border-l border-border flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-yarn-dark">Meeting Tools</h3>
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="ghost" className="w-8 h-8 p-0">
                <Settings className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="w-8 h-8 p-0">
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="w-8 h-8 p-0">
                <Users className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* AI Status */}
          <div className="flex items-center space-x-2 text-sm text-yarn-text">
            <Volume2 className="w-4 h-4" />
            <span>Olio is listening to the conversation</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {systemInfo && (
                <div className="p-2 text-xs text-yarn-text">{systemInfo}</div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.user === "You"
                      ? "bg-yarn-purple/10 border border-yarn-purple/20"
                      : "bg-muted"
                  }`}
                >
                  <div className="font-medium text-sm text-yarn-dark mb-1">
                    {msg.user}
                  </div>
                  <div className="text-sm text-yarn-text">
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Talk to Olio..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSendMessage}
                className="w-10 h-10 p-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Meeting;

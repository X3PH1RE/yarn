import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [message, setMessage] = useState("");
  const [messages] = useState([
    { id: 1, user: "AI Assistant", content: "Welcome to your Yarn meeting! I'm here to help take notes and answer questions.", isAI: true },
    { id: 2, user: "John", content: "Thanks for joining everyone!", isAI: false },
  ]);

  const participants = [
    { id: 1, name: "User 1", isActive: true, isMuted: false },
    { id: 2, name: "User 2", isActive: true, isMuted: true },
    { id: 3, name: "User 3", isActive: false, isMuted: false },
    { id: 4, name: "User 4", isActive: false, isMuted: false },
  ];

  const handleSendMessage = () => {
    if (message.trim()) {
      // In a real app, this would send the message
      setMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col p-4">
        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4 mb-4">
          {participants.map((participant, index) => (
            <div
              key={participant.id}
              className="relative bg-muted rounded-xl overflow-hidden aspect-video border-2 border-border"
            >
              {/* Video placeholder */}
              <div className="w-full h-full bg-gradient-to-br from-yarn-purple/10 to-yarn-blue/10 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-yarn-dark rounded-full flex items-center justify-center mb-2 mx-auto">
                    <span className="text-white font-bold text-xl">
                      {participant.name.slice(-1)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-yarn-text">
                    {participant.name}
                  </span>
                </div>
              </div>
              
              {/* User controls overlay */}
              <div className="absolute bottom-2 left-2 flex items-center space-x-2">
                {participant.isMuted && (
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <MicOff className="w-3 h-3 text-white" />
                  </div>
                )}
                {!participant.isActive && (
                  <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                    <VideoOff className="w-3 h-3 text-white" />
                  </div>
                )}
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
            >
              <Phone className="w-5 h-5" />
            </Button>
            
            <Button
              size="sm"
              variant={isMuted ? "destructive" : "secondary"}
              className="rounded-full w-12 h-12 p-0"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
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
            <span>AI Listening to the conversation</span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg ${
                    msg.isAI
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
                placeholder="Talk to AI..."
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
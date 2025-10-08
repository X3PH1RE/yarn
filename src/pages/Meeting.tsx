import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createSocketConnection, Participant, TranscriptionSegment, AIQuestion, TranscriptionUpdate, AIAnswer, AIQuestionAsked } from "@/lib/realtime";
import AudioCapture from "@/lib/audioCapture";
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
  const [transcription, setTranscription] = useState<TranscriptionSegment[]>([]);
  const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);
  const [aiQuestion, setAiQuestion] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [displayName] = useState<string>(() => {
    const existing = localStorage.getItem("yarnDisplayName");
    if (existing && existing.trim()) return existing;
    const generated = `Guest-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem("yarnDisplayName", generated);
    return generated;
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'chat' | 'participants' | 'transcription'>('chat');
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const audioCaptureRef = useRef<AudioCapture | null>(null);

  const serverUrl = useMemo(() => {
    const envUrl = import.meta.env.VITE_SERVER_URL;
    if (envUrl) {
      console.log('Using backend URL from environment:', envUrl);
      return envUrl;
    }
    console.warn('VITE_SERVER_URL not set, using localhost fallback');
    return "http://localhost:5174";
  }, []);
  const socket = useMemo(() => createSocketConnection(serverUrl), [serverUrl]);

  // Initialize audio capture
  useEffect(() => {
    if (roomId && socket) {
      console.log('🔧 Initializing local transcription for room:', roomId);
      audioCaptureRef.current = new AudioCapture(socket, roomId);
      
      // Set up transcription callback
      audioCaptureRef.current.setTranscriptionCallback((segment) => {
        console.log('🎤 Received local transcription:', segment);
        setTranscription(prev => [...prev, segment]);
        setIsTranscribing(true);
      });
      
      console.log('🔧 Local transcription initialized:', audioCaptureRef.current);
    } else {
      console.log('🔧 Cannot initialize transcription - roomId:', roomId, 'socket:', socket);
    }
  }, [roomId, socket]);

  // Update AI context when transcription changes and send to server
  useEffect(() => {
    if (transcription.length > 0) {
      const context = transcription
        .map(seg => `${seg.speaker}: ${seg.text}`)
        .join('\n');
      setAiContext(context);
      console.log('🔧 Updated AI context:', context);
      
      // Send transcription to server for AI processing
      if (roomId) {
        socket.emit("transcription:update", {
          roomId,
          transcription: transcription
        });
      }
    }
  }, [transcription, roomId, socket]);

  // WebRTC config and helpers
  const rtcConfig = useMemo(() => ({
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
    ],
  }), []);

  const ensurePeerConnection = async (peerId: string) => {
    if (!localStream) return null;
    let pc = peerConnectionsRef.current.get(peerId);
    if (pc) return pc;
    pc = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach((track) => pc!.addTrack(track, localStream));
    pc.onicecandidate = (event) => {
      if (event.candidate && roomId) {
        socket.emit("webrtc:ice-candidate", { roomId, to: peerId, candidate: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams((prev) => ({ ...prev, [peerId]: remoteStream }));
    };
    pc.onconnectionstatechange = () => {
      if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected")) {
        pc.close();
        peerConnectionsRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = { ...prev } as Record<string, MediaStream>;
          delete next[peerId];
          return next;
        });
      }
    };
    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  };

  // Create offers for new participants
  useEffect(() => {
    const run = async () => {
      if (!roomId || !localStream || !selfId) return;
      for (const p of participants) {
        if (p.socketId === selfId) continue;
        if (peerConnectionsRef.current.has(p.socketId)) continue;
        const pc = await ensurePeerConnection(p.socketId);
        if (!pc) continue;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { roomId, to: p.socketId, description: offer });
      }
      const currentIds = new Set(participants.map((p) => p.socketId));
      peerConnectionsRef.current.forEach((pc, id) => {
        if (!currentIds.has(id)) {
          pc.close();
          peerConnectionsRef.current.delete(id);
          setRemoteStreams((prev) => {
            const next = { ...prev } as Record<string, MediaStream>;
            delete next[id];
            return next;
          });
        }
      });
    };
    run();
  }, [participants, localStream, roomId, selfId]);

  // Signaling handlers
  useEffect(() => {
    if (!roomId) return;
    const onOffer = async ({ from, description }: { from: string; description: any }) => {
      const pc = await ensurePeerConnection(from);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(description));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { roomId, to: from, description: answer });
    };
    const onAnswer = async ({ from, description }: { from: string; description: any }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(description));
    };
    const onIce = async ({ from, candidate }: { from: string; candidate: any }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    };
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice-candidate", onIce);
    return () => {
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice-candidate", onIce);
    };
  }, [roomId, socket, localStream]);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("room:join", { roomId, name: displayName });

    const onConnect = () => setSelfId(socket.id);
    const onParticipants = (list: Participant[]) => setParticipants(list);
    const onSystem = (msg: string) => setSystemInfo(msg);
    const onChat = (payload: { id: number; user: string; content: string }) => {
      setMessages((prev) => [...prev, payload]);
    };
    const onTranscriptionUpdate = (data: TranscriptionUpdate) => {
      setTranscription(data.fullTranscription);
      setIsTranscribing(true);
    };
    const onTranscriptionHistory = (history: TranscriptionSegment[]) => {
      setTranscription(history);
    };
    const onAIAnswer = (data: AIAnswer) => {
      // Handle AI answer
      console.log('AI Answer:', data);
    };
    const onAIQuestionAsked = (data: AIQuestionAsked) => {
      // Add to AI questions list
      setAiQuestions(prev => [...prev, {
        id: Date.now().toString(),
        question: data.question,
        answer: data.answer,
        timestamp: data.timestamp
      }]);
    };
    const onAIQuestions = (questions: AIQuestion[]) => {
      setAiQuestions(questions);
    };

    socket.on("connect", onConnect);
    socket.on("participants:update", onParticipants);
    socket.on("system:info", onSystem);
    socket.on("chat:message", onChat);
    socket.on("transcription:update", onTranscriptionUpdate);
    socket.on("transcription:history", onTranscriptionHistory);
    socket.on("ai:answer", onAIAnswer);
    socket.on("ai:question-asked", onAIQuestionAsked);
    socket.on("ai:questions", onAIQuestions);

    return () => {
      socket.emit("room:leave");
      socket.off("connect", onConnect);
      socket.off("participants:update", onParticipants);
      socket.off("system:info", onSystem);
      socket.off("chat:message", onChat);
      socket.off("transcription:update", onTranscriptionUpdate);
      socket.off("transcription:history", onTranscriptionHistory);
      socket.off("ai:answer", onAIAnswer);
      socket.off("ai:question-asked", onAIQuestionAsked);
      socket.off("ai:questions", onAIQuestions);
      socket.disconnect();
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setRemoteStreams({});
      
      // Stop audio capture
      if (audioCaptureRef.current) {
        audioCaptureRef.current.stopCapture();
      }
    };
  }, [roomId, socket, displayName]);

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
        
        // Start audio capture for transcription
        if (audioCaptureRef.current) {
          try {
            await audioCaptureRef.current.startCapture();
            console.log('✅ Audio capture started successfully');
          } catch (error) {
            console.error('❌ Failed to start audio capture:', error);
          }
        } else {
          console.error('❌ Audio capture not initialized');
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

  // Keep the self-preview video element in sync with the latest local stream and state
  useEffect(() => {
    if (!localVideoRef.current) return;
    if (!localStream) return;
    try {
      localVideoRef.current.srcObject = localStream;
      const maybePromise = localVideoRef.current.play();
      if (maybePromise && typeof (maybePromise as Promise<void>).then === 'function') {
        (maybePromise as Promise<void>).catch(() => {});
      }
    } catch (_e) {}
  }, [localStream, isVideoOff]);

  const handleSendMessage = () => {
    if (!roomId) return;
    if (message.trim()) {
      socket.emit("chat:message", { roomId, user: displayName, message });
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
    if (audioCaptureRef.current) {
      audioCaptureRef.current.stopCapture();
    }
    socket.emit("room:leave");
    socket.disconnect();
    navigate("/");
  };

  const handleAIQuestion = () => {
    if (!roomId || !aiQuestion.trim()) return;
    
    // Send question to server for real AI processing
    socket.emit("ai:question", {
      roomId,
      question: aiQuestion.trim(),
      userId: displayName
    });
    
    setAiQuestion("");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col p-4">
        {/* Video Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4 mb-4">
          {/* Always show self preview tile */}
          <div className="relative bg-muted rounded-xl overflow-hidden aspect-video border-2 border-border">
            {localStream ? (
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
                    <span className="text-white font-bold text-xl">{(displayName ?? "You").slice(-1)}</span>
                  </div>
                  <span className="text-sm font-medium text-yarn-text">
                    {displayName ?? "You"}
                  </span>
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 flex items-center space-x-2"></div>
          </div>

          {/* Other participants */}
          {participants.filter((p) => p.socketId !== selfId).map((participant) => (
            <div
              key={participant.socketId}
              className="relative bg-muted rounded-xl overflow-hidden aspect-video border-2 border-border"
            >
              {/* Video placeholder */}
              {
                remoteStreams[participant.socketId] && remoteStreams[participant.socketId].getVideoTracks()[0]?.enabled ? (
                  <video
                    ref={(el) => {
                      if (el && remoteStreams[participant.socketId]) {
                        el.srcObject = remoteStreams[participant.socketId];
                        el.play().catch(() => {});
                      }
                    }}
                    className="w-full h-full object-cover"
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
                )
              }
              
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
              <Button size="sm" variant={activeTab === 'ai' ? 'secondary' : 'ghost'} className="w-8 h-8 p-0" onClick={() => setActiveTab('ai')}>
                <Settings className="w-4 h-4" />
              </Button>
              <Button size="sm" variant={activeTab === 'chat' ? 'secondary' : 'ghost'} className="w-8 h-8 p-0" onClick={() => setActiveTab('chat')}>
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button size="sm" variant={activeTab === 'transcription' ? 'secondary' : 'ghost'} className="w-8 h-8 p-0" onClick={() => setActiveTab('transcription')}>
                <Volume2 className="w-4 h-4" />
              </Button>
              <Button size="sm" variant={activeTab === 'participants' ? 'secondary' : 'ghost'} className="w-8 h-8 p-0" onClick={() => setActiveTab('participants')}>
                <Users className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* AI Status */}
          <div className="flex items-center space-x-2 text-sm text-yarn-text">
            <Volume2 className="w-4 h-4" />
            <span>{isTranscribing ? "Olio is listening and transcribing" : "Olio is ready to listen"}</span>
          </div>
          
          {/* Debug Buttons */}
          <div className="mt-2 space-x-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={async () => {
                console.log('🔧 Test Audio button clicked');
                console.log('🔧 Audio capture ref:', audioCaptureRef.current);
                console.log('🔧 Web Speech API support:', 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
                
                if (audioCaptureRef.current) {
                  try {
                    console.log('🔧 Starting local transcription...');
                    await audioCaptureRef.current.startCapture();
                    console.log('✅ Local transcription started');
                  } catch (error) {
                    console.error('❌ Local transcription failed:', error);
                  }
                } else {
                  console.error('❌ Audio capture ref is null');
                }
              }}
            >
              Test Transcription
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                const testTexts = [
                  "Hello everyone, welcome to our project meeting",
                  "We need to discuss the budget for next quarter",
                  "The deadline for the project is next Friday",
                  "I think we should focus on the user interface first",
                  "What are your thoughts on the timeline?",
                  "We have made good progress this week",
                  "The client is happy with our proposal",
                  "Let's schedule another meeting for next week"
                ];
                
                const randomText = testTexts[Math.floor(Math.random() * testTexts.length)];
                const fakeSegment = {
                  id: 'test-' + Date.now(),
                  speaker: 'Speaker ' + (Math.floor(Math.random() * 3) + 1),
                  text: randomText,
                  timestamp: Date.now(),
                  confidence: 0.85 + Math.random() * 0.1
                };
                setTranscription(prev => [...prev, fakeSegment]);
                console.log('🔧 Added random test transcription:', randomText);
              }}
            >
              Add Random Text
            </Button>
            
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                console.log('🔧 Current AI context:', aiContext);
                alert('AI Context:\n' + aiContext);
              }}
            >
              Show Context
            </Button>
            
            <div className="mt-2">
              <Input
                placeholder="Type what you want to say..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    const text = e.currentTarget.value.trim();
                    const fakeSegment = {
                      id: 'manual-' + Date.now(),
                      speaker: 'You',
                      text: text,
                      timestamp: Date.now(),
                      confidence: 0.95
                    };
                    setTranscription(prev => [...prev, fakeSegment]);
                    e.currentTarget.value = '';
                    console.log('🔧 Added manual transcription:', text);
                  }
                }}
                className="text-sm"
              />
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 flex flex-col">
          {activeTab === 'ai' && (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {aiQuestions.map((qa) => (
                    <div key={qa.id} className="p-3 rounded-lg bg-muted">
                      <div className="font-medium text-sm text-yarn-dark mb-2">
                        Q: {qa.question}
                      </div>
                      <div className="text-sm text-yarn-text">
                        A: {qa.answer}
                      </div>
                      <div className="text-xs text-yarn-text/60 mt-2">
                        {new Date(qa.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  {aiQuestions.length === 0 && (
                    <div className="text-center text-yarn-text/60 py-8">
                      No AI questions yet. Ask Olio about the meeting!
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* AI Question Input */}
              <div className="p-4 border-t border-border">
                <div className="space-y-2">
                  <Input
                    placeholder="Ask Olio about the meeting..."
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAIQuestion()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAIQuestion}
                    disabled={!aiQuestion.trim()}
                    className="w-full bg-yarn-purple/20 text-yarn-dark border border-yarn-dark hover:bg-yarn-purple/30"
                  >
                    Ask Olio
                  </Button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'chat' && (
            <>
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
                    placeholder="Type a message..."
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
            </>
          )}

          {activeTab === 'transcription' && (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {transcription.map((segment) => (
                  <div key={segment.id} className="p-3 rounded-lg bg-muted">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-yarn-dark">
                        {segment.speaker}
                      </span>
                      <span className="text-xs text-yarn-text/60">
                        {new Date(segment.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm text-yarn-text">
                      {segment.text}
                    </div>
                    <div className="text-xs text-yarn-text/60 mt-1">
                      Confidence: {Math.round(segment.confidence * 100)}%
                    </div>
                  </div>
                ))}
                {transcription.length === 0 && (
                  <div className="text-center text-yarn-text/60 py-8">
                    No transcription yet. Start speaking to see real-time transcription!
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {activeTab === 'participants' && (
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {participants.map((p) => (
                  <div key={p.socketId} className="flex items-center justify-between p-2 rounded border border-border">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-yarn-dark rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{(p.name ?? p.socketId).slice(-1)}</span>
                      </div>
                      <div className="text-sm text-yarn-dark">
                        {(p.name ?? p.socketId)} {p.socketId === selfId ? <span className="text-xs text-yarn-text">(You)</span> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
};

export default Meeting;

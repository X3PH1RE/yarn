import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, Mic, MicOff, Users, Monitor, Lightbulb, Send,
  Settings, MessageCircle, Volume2, VideoOff, Video, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// --- DUMMY COMPONENTS (Required for standalone execution) ---
const Button = ({ children, onClick, variant, size, className, disabled }: any) => (
  <button
    onClick={onClick}
    className={`p-3 rounded-lg text-sm font-medium transition-colors duration-150 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    disabled={disabled}
  >
    {children}
  </button>
);

const Input = ({ placeholder, value, onChange, onKeyPress, className, disabled }: any) => (
  <input
    type="text"
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    onKeyPress={onKeyPress}
    className={`border p-2 w-full rounded-lg shadow-inner focus:ring-indigo-500 focus:border-indigo-500 ${className}`}
    disabled={disabled}
  />
);

const ScrollArea = ({ children, className }: any) => (
  <div className={`overflow-y-auto ${className}`}>{children}</div>
);
// --- END DUMMY COMPONENTS ---

// --- CONFIGURATION ---
const API_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000";
const ROOM_ID = "meeting-123";

type TranscriptLine = {
  user: string;
  content: string;
  isAI: boolean;
};

type DemoTranscriptEntry = {
  timestamp: string;
  speaker: string;
  content: string;
};

// --- useMeetingPipeline (unchanged transcription & AI logic) ---
const useMeetingPipeline = () => {
  const [audioData, setAudioData] = useState<DemoTranscriptEntry[]>([]);
  const [aiChat, setAiChat] = useState<TranscriptLine[]>([
    { user: "Olio", content: "Welcome! Click the Lightbulb button to start transcription/recording of the meeting audio.", isAI: true },
  ]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isTranscriptionActive, setIsTranscriptionActive] = useState(false);
  const [isAudioSharing, setIsAudioSharing] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Ready to record.");

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const cleanupMedia = () => {
    mediaStream.current?.getTracks().forEach(track => track.stop());
    mediaStream.current = null;
  };

  const startTranscription = useCallback(async () => {
    if (isTranscriptionActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStream.current = stream;

      audioChunks.current = [];
      mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.current.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        setStatusMessage("Transcription stopped. Sending audio for analysis...");
        setIsTranscribing(true);

        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

        await sendAudioForAnalysis(audioFile);
        cleanupMedia();
        setIsTranscriptionActive(false);
      };

      mediaRecorder.current.start();
      setIsTranscriptionActive(true);
      setStatusMessage("Recording meeting audio... Click lightbulb to stop.");

    } catch (error) {
      console.error("Microphone access (or simulated meeting audio access) failed:", error);
      setStatusMessage("Error accessing mic/audio. Check permissions or console.");
      setIsTranscriptionActive(false);
    }
  }, [isTranscriptionActive]);

  const stopTranscription = useCallback(() => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
  }, []);

  const toggleTranscription = () => {
    if (isTranscriptionActive) {
      stopTranscription();
    } else {
      startTranscription();
    }
  };

  const toggleMic = () => {
    setIsAudioSharing(prev => !prev);
    console.log(`User's mic Toggled: ${!isAudioSharing ? 'Unmuted' : 'Muted'}`);
  };

  const sendAudioForAnalysis = async (audioFile: File) => {
    setIsTranscribing(true);

    const formData = new FormData();
    formData.append('audio_file', audioFile);
    formData.append('title', 'Recorded Meeting Demo');

    try {
      const response = await fetch(`${API_URL}/api/demo/analyze-audio`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Server Error: ${response.status}`);
      }

      const data = await response.json();

      setAudioData(data.full_context_list);

      setAiChat(prev => [
        ...prev,
        { user: "Olio", content: `Transcription complete. Summary: ${data.initial_summary}`, isAI: true }
      ]);

      setStatusMessage("Ready for chat.");

    } catch (error: any) {
      console.error("Audio analysis failed:", error);
      setAiChat(prev => [
        ...prev,
        { user: "System Error", content: `Failed to analyze audio: ${error.message}`, isAI: true }
      ]);
      setStatusMessage("Analysis failed.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAiQuery = useCallback(async (queryText: string) => {
    if (audioData.length === 0) {
      setAiChat(chat => [...chat, { user: "Olio", content: "Please record or upload audio first.", isAI: true }]);
      return;
    }

    setIsAiLoading(true);
    setAiChat(chat => [...chat, { user: "You", content: queryText, isAI: false }]);
    setStatusMessage("Querying context...");

    const payload = {
      transcript_context: audioData,
      user_query: queryText
    };

    try {
      const response = await fetch(`${API_URL}/api/demo/query-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Server Error: ${response.status}`);
      }

      const data = await response.json();

      setAiChat(chat => [...chat, { user: "Olio", content: data.analysis_result, isAI: true }]);

    } catch (error: any) {
      console.error("AI Query failed:", error);
      setAiChat(chat => [...chat, { user: "System Error", content: `Query failed: ${error.message}`, isAI: true }]);
    } finally {
      setIsAiLoading(false);
      setStatusMessage("Ready for chat.");
    }
  }, [audioData]);

  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, []);

  return {
    audioData,
    aiChat,
    isTranscribing,
    isAiLoading,
    statusMessage,
    isTranscriptionActive,
    toggleTranscription,
    isAudioSharing,
    toggleMic,
    mediaRecorderRef: mediaRecorder,
    handleAiQuery
  };
};

// --- Meeting Component (full) ---
const Meeting: React.FC = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [allParticipants, setAllParticipants] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"ai" | "chat" | "participants">("ai");
  const [participantChatMessages, setParticipantChatMessages] = useState<any[]>([]);
  const [participantChatInput, setParticipantChatInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const userId = useRef<string>(crypto.randomUUID());
  const [userName, setUserName] = useState<string>("Loading...");

  // Check authentication and get user name - redirect if not logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in to join a meeting");
        navigate("/");
        return;
      }
      
      // Set user name from Supabase auth
      const user = session.user;
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || "Guest";
      setUserName(displayName);
      console.log("👤 User joined:", displayName);
    };
    checkAuth();
  }, [navigate]);

  // Show local user immediately in participant list
  useEffect(() => {
    if (isConnected && allParticipants.length === 0 && userName !== "Loading...") {
      // Add ourselves to the list if not already there
      setAllParticipants([{
        id: userId.current,
        name: userName,
        isMuted: !isAudioSharing,
        isActive: true
      }]);
    }
  }, [isConnected, userName]);

  const wsRef = useRef<WebSocket | null>(null);

  const {
    audioData,
    aiChat,
    isTranscribing,
    isAiLoading,
    statusMessage,
    isTranscriptionActive,
    toggleTranscription,
    isAudioSharing,
    toggleMic,
    mediaRecorderRef,
    handleAiQuery
  } = useMeetingPipeline();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const participantChatEndRef = useRef<HTMLDivElement>(null);

  // WebRTC related refs/state
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ [id: string]: MediaStream }>({});
  const peerConnections = useRef<{ [id: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  // Create RTCPeerConnection helper
  const createPeerConnection = async (remoteId: string) => {
    if (peerConnections.current[remoteId]) return peerConnections.current[remoteId];

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(JSON.stringify({
          type: 'ice-candidate',
          to: remoteId,
          from: userId.current,
          candidate: event.candidate,
        }));
      }
    };

    pc.ontrack = (event) => {
      // event.streams[0] is the remote MediaStream
      setRemoteStreams(prev => ({ ...prev, [remoteId]: event.streams[0] }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        delete peerConnections.current[remoteId];
        setRemoteStreams(prev => {
          const copy = { ...prev };
          delete copy[remoteId];
          return copy;
        });
      }
    };

    // Add local tracks
    localStreamRef.current?.getTracks().forEach(track => {
      try { pc.addTrack(track, localStreamRef.current as MediaStream); } catch (e) { /* ignore */ }
    });

    peerConnections.current[remoteId] = pc;
    return pc;
  };

  // WebSocket & initial local media setup
  useEffect(() => {
    // Wait until userName is loaded from Supabase
    if (userName === "Loading...") return;
    
    const encodedUserName = encodeURIComponent(userName);
    wsRef.current = new WebSocket(`${WS_URL}/ws/${ROOM_ID}?user_id=${userId.current}&user_name=${encodedUserName}`);

    wsRef.current.onopen = async () => {
      console.log("✅ WebSocket connected. Room ID:", ROOM_ID);
      setIsConnected(true);

      // Acquire local camera + mic
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // If user toggles local mic state (isAudioSharing false), mute tracks locally
        if (!isAudioSharing) {
          stream.getAudioTracks().forEach(t => t.enabled = false);
        }

      } catch (err) {
        console.error("❌ Failed to get user media:", err);
      }
    };

    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("📨 WebSocket message received:", data.type);

      // Participants update (keeps existing behavior)
      if (data.type === 'PARTICIPANTS_UPDATE') {
        console.log("👥 Participants update:", data.participants);
        setAllParticipants(data.participants);
      }

      // Legacy status messages
      if (data.type === 'STATUS') {
        console.log("📢 Status:", data.message);
      }

      // Live transcript broadcast (text)
      if (data.type === 'TRANSCRIPT_UPDATE') {
        // Optionally integrate incoming live transcript into audioData or display
        console.log("Transcript update from", data.user_name, data.text);
      }

      // Participant chat messages
      if (data.type === 'CHAT_MESSAGE') {
        setParticipantChatMessages(prev => [...prev, {
          sender_id: data.sender_id,
          sender_name: data.sender_name,
          text: data.text,
          timestamp: data.timestamp
        }]);
      }

      // WebRTC signaling messages
      if (data.type === 'offer' && data.to === userId.current) {
        // incoming offer -> create PC, setRemote, create answer
        const fromId = data.from;
        const offer = data.offer;
        const pc = await createPeerConnection(fromId);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsRef.current?.send(JSON.stringify({
          type: 'answer',
          to: fromId,
          from: userId.current,
          answer: pc.localDescription
        }));
      }

      if (data.type === 'answer' && data.to === userId.current) {
        const fromId = data.from;
        const answer = data.answer;
        const pc = peerConnections.current[fromId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      }

      if (data.type === 'ice-candidate' && data.to === userId.current) {
        const fromId = data.from;
        const candidate = data.candidate;
        const pc = peerConnections.current[fromId];
        if (pc) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn("Failed to add ICE candidate:", err);
          }
        }
      }
    };

    wsRef.current.onclose = () => {
      console.log("❌ WebSocket disconnected.");
      setIsConnected(false);
      setAllParticipants([]);
      // Cleanup peer connections
      Object.values(peerConnections.current).forEach(pc => {
        try { pc.close(); } catch { }
      });
      peerConnections.current = {};
      setRemoteStreams({});
    };

    wsRef.current.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
      console.error("Make sure the backend server is running at:", WS_URL);
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
      // stop local stream
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]); // re-run when userName is loaded

  // React to participants list changes — create offers to new peers
  useEffect(() => {
    (async () => {
      if (!wsRef.current) return;
      for (const p of allParticipants) {
        if (p.id === userId.current) continue;
        if (peerConnections.current[p.id]) continue; // already connected/connecting

        try {
          const pc = await createPeerConnection(p.id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          wsRef.current.send(JSON.stringify({
            type: 'offer',
            to: p.id,
            from: userId.current,
            offer: pc.localDescription
          }));
        } catch (err) {
          console.error("Failed to create offer to", p.id, err);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allParticipants]);

  // Keep local mic and camera enabled/disabled based on state
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = isAudioSharing;
      });
    }
  }, [isAudioSharing]);

  useEffect(() => {
    if (localStreamRef.current && !isScreenSharing) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = isCameraOn;
      });
    }
  }, [isCameraOn, isScreenSharing]);

  // Auto-scroll effects
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiChat]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [audioData]);
  useEffect(() => { participantChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [participantChatMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const queryText = message.trim();
    if (queryText) {
      handleAiQuery(queryText);
      setMessage("");
    }
  };

  const handleSendParticipantChat = (e: React.FormEvent) => {
    e.preventDefault();
    const chatText = participantChatInput.trim();
    if (chatText && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: "CHAT_MESSAGE",
        sender_id: userId.current,
        sender_name: userName,
        text: chatText
      }));
      setParticipantChatInput("");
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOn(prev => !prev);
      console.log(`📹 Camera ${!isCameraOn ? 'enabled' : 'disabled'}`);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing, go back to camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        // Replace tracks in all peer connections
        const videoTrack = stream.getVideoTracks()[0];
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });

        // Stop old stream
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        
        // Update local stream
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Apply audio state
        stream.getAudioTracks().forEach(t => t.enabled = isAudioSharing);
        stream.getVideoTracks().forEach(t => t.enabled = isCameraOn);

        setIsScreenSharing(false);
        console.log('📹 Switched back to camera');
      } else {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        
        // Replace video track in all peer connections
        const screenTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        // Keep audio from original stream, add screen video
        const audioTracks = localStreamRef.current?.getAudioTracks() || [];
        const newStream = new MediaStream([...audioTracks, screenTrack]);

        // Update local display
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = newStream;
        }

        // Stop old video tracks
        localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
        localStreamRef.current = newStream;

        setIsScreenSharing(true);
        console.log('🖥️ Screen sharing started');

        // Handle screen share stop (user clicks browser's stop sharing button)
        screenTrack.onended = () => {
          toggleScreenShare(); // Switch back to camera
        };
      }
    } catch (err) {
      console.error('❌ Screen share error:', err);
    }
  };

  const isRecording = isTranscriptionActive;

  const getTranscriptionButtonClass = () => {
    if (isRecording) {
      return 'bg-indigo-500 text-white hover:bg-indigo-600 animate-pulse';
    }
    if (audioData.length > 0) {
      return 'bg-green-600 text-white hover:bg-green-700';
    }
    return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  };

  const getMicButtonClass = () => {
    return isAudioSharing ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-red-500 text-white hover:bg-red-600';
  };

  const getCameraButtonClass = () => {
    return isCameraOn ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-red-500 text-white hover:bg-red-600';
  };

  const getScreenShareButtonClass = () => {
    return isScreenSharing ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  };

  const participants = allParticipants;
  const gridClass = participants.length <= 2 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-2';

  return (
    <div className="h-screen bg-gray-50 flex text-gray-800 overflow-hidden" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Video Grid (Now dynamically populated) */}
        <div className={`flex-1 grid gap-4 mb-4 ${gridClass} overflow-auto`}>
          {participants.length === 0 ? (
            <div className="w-full h-full bg-indigo-50/50 rounded-xl flex flex-col items-center justify-center border-dashed border-2 border-indigo-300 p-8">
              {isConnected ? (
                <>
                  <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-indigo-700 font-medium text-lg">Connecting to room...</p>
                  <p className="text-indigo-500 text-sm mt-2">Initializing video...</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-red-700 font-medium text-lg">Connecting to server...</p>
                  <p className="text-red-500 text-sm mt-2">Make sure the backend is running on port 8000</p>
                  <p className="text-gray-500 text-xs mt-4 font-mono">cd server && python main.py</p>
                </>
              )}
            </div>
          ) : (
            participants.map((participant) => (
              <div
                key={participant.id}
                className={`relative bg-gray-100 rounded-xl overflow-hidden aspect-video shadow-lg border-2 ${participant.id === userId.current ? 'border-indigo-500' : 'border-gray-200'}`}
              >
                <div className="w-full h-full bg-gradient-to-br from-indigo-50/50 to-purple-50/50 flex items-center justify-center">
                  {participant.id === userId.current ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    remoteStreams[participant.id] ? (
                      <video
                        autoPlay
                        playsInline
                        ref={(el) => {
                          if (!el) return;
                          if (el.srcObject !== remoteStreams[participant.id]) {
                            el.srcObject = remoteStreams[participant.id];
                          }
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-indigo-600/80 rounded-full flex items-center justify-center mb-2 mx-auto shadow-md">
                          <span className="text-white font-bold text-xl">
                            {participant.name.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {participant.name}
                        </span>
                        <p className="text-xs text-gray-500 mt-2">Connecting...</p>
                      </div>
                    )
                  )}
                </div>

                {/* Mute and Camera Off state indicators */}
                <div className="absolute top-2 right-2 flex items-center space-x-2">
                  {participant.id === userId.current && !isAudioSharing && (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                      <MicOff className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {participant.id === userId.current && !isCameraOn && (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                      <VideoOff className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {participant.id === userId.current && isScreenSharing && (
                    <div className="px-2 py-1 bg-green-500 rounded-md flex items-center shadow-md">
                      <Monitor className="w-3 h-3 text-white mr-1" />
                      <span className="text-xs text-white font-semibold">Sharing</span>
                    </div>
                  )}
                  {participant.id !== userId.current && participant.isMuted && (
                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                      <MicOff className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Live Transcript and Control Bar */}
        <div className="flex flex-col space-y-4 flex-shrink-0">
          <div className="p-4 bg-white rounded-xl shadow-lg border border-gray-200 h-32 flex flex-col">
            <h2 className="text-sm font-bold border-b pb-2 mb-2 text-indigo-700 uppercase tracking-wider flex-shrink-0">
              Meeting Transcript (File Analysis)
              <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${isTranscribing || isRecording ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                {isTranscribing ? 'Processing Audio...' : isRecording ? 'Recording All Audio...' : statusMessage}
              </span>
            </h2>
            <ScrollArea className="flex-1 overflow-auto">
              {audioData.length === 0 ? (
                <p className="text-gray-500 italic text-sm mt-2">
                  Start the transcription using the **Lightbulb button** below to capture all meeting audio.
                </p>
              ) : (
                audioData.map((line, index) => (
                  <p key={index} className={`mb-1 text-xs ${line.speaker === 'Transcription' ? 'text-gray-700' : 'text-gray-600 italic'}`}>
                    <span className="font-semibold mr-1">[{line.timestamp}]:</span>
                    {line.content}
                  </p>
                ))
              )}
              <div ref={transcriptEndRef} />
            </ScrollArea>
          </div>

          {/* Control Bar */}
          <div className="flex justify-center flex-shrink-0">
            <div className="bg-white rounded-full px-6 py-4 shadow-xl border border-gray-100 flex items-center space-x-3">
              <Button
                size="lg"
                variant="destructive"
                className="rounded-full w-12 h-12 p-0 bg-red-700 text-white hover:bg-red-800 flex items-center justify-center shadow-lg"
                onClick={() => alert("Ending meeting...")}
              >
                <Phone className="w-5 h-5" />
              </Button>

              {/* Transcription Button */}
              <Button
                size="lg"
                variant="secondary"
                className={`rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg ${getTranscriptionButtonClass()}`}
                onClick={toggleTranscription}
                disabled={isAiLoading || isTranscribing}
              >
                {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lightbulb className="w-5 h-5" />}
              </Button>

              {/* Mic Button (local mute/unmute) */}
              <Button
                size="lg"
                variant="secondary"
                className={`rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg ${getMicButtonClass()}`}
                onClick={toggleMic}
              >
                {isAudioSharing ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              {/* Camera Button */}
              <Button 
                size="lg" 
                variant="secondary" 
                className={`rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg ${getCameraButtonClass()}`}
                onClick={toggleCamera}
              >
                {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              {/* Screen Share Button */}
              <Button 
                size="lg" 
                variant="secondary" 
                className={`rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg ${getScreenShareButtonClass()}`}
                onClick={toggleScreenShare}
              >
                <Monitor className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Tabbed Interface */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-2xl overflow-hidden">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <button
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
              activeTab === "ai" ? "bg-white text-indigo-700 border-b-2 border-indigo-700" : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setActiveTab("ai")}
          >
            <Lightbulb className="w-4 h-4 inline mr-1" />
            Olio
          </button>
          <button
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
              activeTab === "chat" ? "bg-white text-indigo-700 border-b-2 border-indigo-700" : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setActiveTab("chat")}
          >
            <MessageCircle className="w-4 h-4 inline mr-1" />
            Chat
          </button>
          <button
            className={`flex-1 py-3 px-4 text-sm font-semibold transition-colors ${
              activeTab === "participants" ? "bg-white text-indigo-700 border-b-2 border-indigo-700" : "text-gray-600 hover:text-gray-800"
            }`}
            onClick={() => setActiveTab("participants")}
          >
            <Users className="w-4 h-4 inline mr-1" />
            People
          </button>
        </div>

        {/* AI Assistant Tab */}
        {activeTab === "ai" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex-none">
              <h3 className="font-extrabold text-xl text-indigo-700">Olio - Your Meeting Assistant</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg mt-2">
                <Volume2 className="w-4 h-4 text-indigo-500" />
                <span>{isAiLoading ? 'AI is thinking...' : statusMessage}</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
              <ScrollArea className="flex-1 p-4 overflow-auto">
                <div className="space-y-4">
                  {aiChat.map((msg, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-xl shadow-sm ${msg.isAI ? "bg-indigo-50 border border-indigo-100" : "bg-white border border-gray-100 text-right ml-auto"} max-w-[85%]`}
                    >
                      <div className={`font-semibold text-sm mb-1 ${msg.isAI ? 'text-indigo-700' : 'text-gray-700'}`}>
                        {msg.user}
                      </div>
                      <div className="text-sm text-gray-800">
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isAiLoading && (
                    <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 max-w-[85%]">
                      <p className="font-semibold text-sm mb-1 text-indigo-700">Olio (Thinking...)</p>
                      <div className="w-4 h-4 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 flex-none bg-white">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Ask Olio about the meeting..."
                    value={message}
                    onChange={(e: any) => setMessage(e.target.value)}
                    disabled={isAiLoading || isTranscribing || audioData.length === 0}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    className="w-10 h-10 p-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={isAiLoading || isTranscribing || !message.trim() || audioData.length === 0}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Participant Chat Tab */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex-none">
              <h3 className="font-extrabold text-xl text-indigo-700">Participant Chat</h3>
              <p className="text-xs text-gray-600 mt-1">Chat with other meeting participants</p>
            </div>

            <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
              <ScrollArea className="flex-1 p-4 overflow-auto">
                <div className="space-y-3">
                  {participantChatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm mt-8">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    participantChatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-xl shadow-sm ${
                          msg.sender_id === userId.current
                            ? "bg-indigo-100 border border-indigo-200 ml-auto"
                            : "bg-white border border-gray-200"
                        } max-w-[85%]`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold text-xs ${
                            msg.sender_id === userId.current ? 'text-indigo-800' : 'text-gray-700'
                          }`}>
                            {msg.sender_id === userId.current ? 'You' : msg.sender_name}
                          </span>
                          <span className="text-xs text-gray-500">{msg.timestamp}</span>
                        </div>
                        <div className="text-sm text-gray-800">
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={participantChatEndRef} />
                </div>
              </ScrollArea>

              <form onSubmit={handleSendParticipantChat} className="p-4 border-t border-gray-200 flex-none bg-white">
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="Type a message..."
                    value={participantChatInput}
                    onChange={(e: any) => setParticipantChatInput(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={handleSendParticipantChat}
                    className="w-10 h-10 p-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={!participantChatInput.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Participants List Tab */}
        {activeTab === "participants" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex-none">
              <h3 className="font-extrabold text-xl text-indigo-700">Participants</h3>
              <p className="text-xs text-gray-600 mt-1">{participants.length} {participants.length === 1 ? 'person' : 'people'} in this meeting</p>
            </div>

            <div className="flex-1 bg-gray-50 overflow-hidden">
              <ScrollArea className="h-full p-4 overflow-auto">
                <div className="space-y-2">
                  {participants.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm mt-8">
                      <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No participants yet</p>
                    </div>
                  ) : (
                    participants.map((participant) => (
                      <div
                        key={participant.id}
                        className={`p-3 rounded-lg border ${
                          participant.id === userId.current
                            ? 'bg-indigo-50 border-indigo-200'
                            : 'bg-white border-gray-200'
                        } flex items-center space-x-3 hover:shadow-md transition-shadow`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          participant.id === userId.current ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}>
                          <span className="text-white font-bold text-sm">
                            {participant.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-gray-800">
                              {participant.name}
                            </span>
                            {participant.id === userId.current && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">You</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {participant.isMuted ? (
                              <span className="text-xs text-red-600 flex items-center">
                                <MicOff className="w-3 h-3 mr-1" /> Muted
                              </span>
                            ) : (
                              <span className="text-xs text-green-600 flex items-center">
                                <Mic className="w-3 h-3 mr-1" /> Active
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Meeting;

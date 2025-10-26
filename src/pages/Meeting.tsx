import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Phone, Mic, MicOff, Users, Monitor, Lightbulb, Send,
    Settings, MessageCircle, Volume2, VideoOff,
} from "lucide-react";

// --- CONFIGURATION & API HOOK ---
// NOTE: Ensure your FastAPI backend is running on port 8000
const API_URL = "http://localhost:8000";

type TranscriptLine = {
    user: string;
    content: string;
    isAI: boolean;
};

// Hook to handle all state and API interactions for the AI/Transcription pipeline
const useMeetingPipeline = () => {
    const [meetingId, setMeetingId] = useState<number | null>(null);
    const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
    const [aiChat, setAiChat] = useState<TranscriptLine[]>([
        { user: "Olio", content: "Welcome! Click the Mic button to create a meeting, connect your audio, and start the transcription stream.", isAI: true },
    ]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Offline");

    const ws = useRef<WebSocket | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const mediaStream = useRef<MediaStream | null>(null);

    // --- Core WebSocket/Audio Management ---

    const startRecordingAndStreaming = useCallback(async () => {
        if (!meetingId) {
            setStatusMessage("Error: No Meeting ID.");
            return;
        }

        try {
            // 1. Get Microphone Permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            mediaStream.current = stream;

            // 2. Establish WebSocket to FastAPI
            const WS_URL = `ws://localhost:8000/ws/transcript/${meetingId}`;
            const newWs = new WebSocket(WS_URL);
            ws.current = newWs;

            newWs.onopen = () => {
                setStatusMessage("Connected. Streaming audio to Deepgram...");
                setIsTranscribing(true);

                // 3. Start MediaRecorder
                mediaRecorder.current = new MediaRecorder(stream, { 
                    mimeType: 'audio/webm;codecs=opus' // Use a common codec
                });

                mediaRecorder.current.ondataavailable = (e) => {
                    // Send raw audio data to the FastAPI WebSocket
                    if (e.data.size > 0 && ws.current?.readyState === WebSocket.OPEN) {
                        e.data.arrayBuffer().then(buffer => {
                            ws.current!.send(buffer);
                        });
                    }
                };

                mediaRecorder.current.onstop = () => {
                    setStatusMessage("Recording stopped. Waiting for final transcription...");
                };

                // Start recording, sending data every 250ms
                mediaRecorder.current.start(250); 
            };

            newWs.onmessage = (event) => {
                const data = JSON.parse(event.data);
                const line: TranscriptLine = {
                    user: data.user,
                    content: data.content,
                    isAI: data.user === 'Olio' || data.user === 'System',
                };
                setTranscript(t => [...t, line]);
                
                if (data.content.includes("Transcription finished")) {
                    setIsTranscribing(false);
                    setStatusMessage("Transcription complete. Ready for AI query.");
                }
            };

            newWs.onclose = () => {
                setIsTranscribing(false);
                setStatusMessage("Connection closed.");
                cleanupMedia();
            };

            newWs.onerror = (error) => {
                console.error("WebSocket Error:", error);
                setStatusMessage("Connection Error. Is FastAPI running?");
                setIsTranscribing(false);
                cleanupMedia();
            };

        } catch (error) {
            console.error("Microphone or WS initialization failed:", error);
            setStatusMessage("Error accessing mic. Check permissions or console.");
            setIsTranscribing(false);
            cleanupMedia();
        }
    }, [meetingId]);

    const stopStreaming = useCallback(() => {
        if (mediaRecorder.current?.state === 'recording') {
            mediaRecorder.current.stop();
        }
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
        cleanupMedia();
        setIsTranscribing(false);
    }, []);

    const cleanupMedia = () => {
        mediaStream.current?.getTracks().forEach(track => track.stop());
        mediaStream.current = null;
    };

    // --- AI Query Logic ---

    const handleAiQuery = useCallback(async (queryText: string) => {
        if (!meetingId) {
            setAiChat(chat => [...chat, { user: "Olio", content: "Please start a meeting first.", isAI: true }]);
            return;
        }

        setIsAiLoading(true);
        setAiChat(chat => [...chat, { user: "You", content: queryText, isAI: false }]);
        setStatusMessage("Sending query to Gemini...");

        try {
            const response = await fetch(`${API_URL}/api/ai/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryText, meeting_id: meetingId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Backend responded with status ${response.status}.`);
            }

            const data = await response.json();
            setAiChat(chat => [...chat, { user: "Olio", content: data.response, isAI: true }]);

        } catch (error: any) {
            setAiChat(chat => [...chat, { user: "Olio", content: `AI Error: ${error.message}.`, isAI: true }]);
        } finally {
            setIsAiLoading(false);
            setStatusMessage("Ready.");
        }
    }, [meetingId]);

    // --- Meeting Lifecycle ---

    const toggleMic = async () => {
        if (!isTranscribing) {
            if (!meetingId) {
                 // 1. Create meeting ID if none exists
                const createResponse = await fetch(`${API_URL}/api/meeting/create`, { method: 'POST' });
                const data = await createResponse.json();
                setMeetingId(data.meeting_id);
                setTranscript([]); // Clear old transcript
                
                // 2. Start streaming with the new ID
                await startRecordingAndStreaming();

            } else {
                // Meeting exists, just start streaming
                await startRecordingAndStreaming();
            }
        } else {
            stopStreaming();
        }
    };
    
    // Cleanup effect
    useEffect(() => {
        return () => {
            stopStreaming();
        };
    }, []);

    return { 
        meetingId,
        transcript, 
        aiChat, 
        isTranscribing, 
        isAiLoading, 
        statusMessage,
        toggleMic,
        handleAiQuery 
    };
};

// --- REACT COMPONENT ---

const Meeting = () => {
    // Dummy states for UI elements not handled by the pipeline hook
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [message, setMessage] = useState("");
    
    const participants = [
        { id: 1, name: "Ashwin VC", isActive: true, isMuted: false },
        { id: 2, name: "Lekshmi Priya M", isActive: true, isMuted: true },
        { id: 3, name: "Austin Benny", isActive: true, isMuted: false },
        { id: 4, name: "Smitha John", isActive: false, isMuted: false },
    ];
    
    const { 
        meetingId,
        transcript, 
        aiChat, 
        isTranscribing, 
        isAiLoading, 
        statusMessage,
        toggleMic,
        handleAiQuery 
    } = useMeetingPipeline();

    // Refs for auto-scrolling
    const chatEndRef = useRef<HTMLDivElement>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll effects
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiChat]);
    useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);


    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const queryText = message.trim();
        if (queryText) {
            handleAiQuery(queryText);
            setMessage("");
        }
    };

    // NOTE: Tailwind classes for UI components are preserved from previous context, 
    // but the actual Button, Input, and ScrollArea components need to be imported 
    // from your project's component library.

    return (
        <div className="min-h-screen bg-gray-50 flex text-gray-800" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Main Video Area */}
            <div className="flex-1 flex flex-col p-4">
                {/* Video Grid (Simplified) */}
                <div className="flex-1 grid grid-cols-2 gap-4 mb-4">
                    {participants.map((participant) => (
                        <div
                            key={participant.id}
                            className="relative bg-gray-100 rounded-xl overflow-hidden aspect-video shadow-lg border-2 border-indigo-200/50"
                        >
                            {/* Video placeholder content... */}
                            <div className="w-full h-full bg-gradient-to-br from-indigo-50/50 to-purple-50/50 flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-indigo-600/80 rounded-full flex items-center justify-center mb-2 mx-auto shadow-md">
                                        <span className="text-white font-bold text-xl">
                                            {participant.name.split(' ').map(n => n[0]).join('')}
                                        </span>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                        {participant.name}
                                    </span>
                                </div>
                            </div>
                            
                            {/* User controls overlay... */}
                            <div className="absolute top-2 right-2 flex items-center space-x-2">
                                {participant.isMuted && (
                                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                                        <MicOff className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Live Transcript and Control Bar */}
                <div className="flex flex-col space-y-4">
                    {/* Live Transcript Panel */}
                    <div className="flex-1 p-4 bg-white rounded-xl shadow-lg border border-gray-200 h-40">
                        <h2 className="text-sm font-bold border-b pb-2 mb-2 text-indigo-700 uppercase tracking-wider">
                            Live Transcription (Meeting ID: {meetingId ?? 'N/A'})
                            <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${isTranscribing ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isTranscribing ? 'Listening...' : statusMessage}
                            </span>
                        </h2>
                        <ScrollArea className="h-[calc(100%-2.5rem)]">
                            {transcript.length === 0 ? (
                                <p className="text-gray-500 italic text-sm mt-2">
                                    Start transcription using the mic button below.
                                </p>
                            ) : (
                                transcript.map((line, index) => (
                                    <p key={index} className={`mb-1 text-xs ${line.isAI ? 'text-orange-500 italic' : 'text-gray-700'}`}>
                                        <span className="font-semibold mr-1">{line.user}:</span>
                                        {line.content}
                                    </p>
                                ))
                            )}
                            <div ref={transcriptEndRef} />
                        </ScrollArea>
                    </div>

                    {/* Control Bar */}
                    <div className="flex justify-center">
                        <div className="bg-white rounded-full px-4 py-3 shadow-xl border border-gray-100 flex items-center space-x-4">
                            <Button
                                size="lg"
                                variant="destructive"
                                className="rounded-full w-14 h-14 p-0"
                                onClick={() => alert("Ending meeting...")}
                            >
                                <Phone className="w-6 h-6" />
                            </Button>
                            
                            <Button
                                size="lg"
                                variant={isTranscribing ? "destructive" : "secondary"}
                                className={`rounded-full w-14 h-14 p-0 ${isTranscribing ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                onClick={toggleMic}
                            >
                                {isTranscribing ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </Button>
                            
                            {/* Other Controls */}
                            <Button size="lg" variant="secondary" className="rounded-full w-14 h-14 p-0 bg-gray-100" disabled><VideoOff className="w-6 h-6" /></Button>
                            <Button size="lg" variant="secondary" className="rounded-full w-14 h-14 p-0 bg-gray-100" disabled><Monitor className="w-6 h-6" /></Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar: AI Chat */}
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-2xl">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-gray-200 flex-none">
                    <h3 className="font-extrabold text-xl text-indigo-700">AI Assistant</h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg mt-2">
                        <Volume2 className="w-4 h-4 text-indigo-500" />
                        <span>{statusMessage}</span>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-gray-50">
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                            {aiChat.map((msg, index) => (
                                <div
                                    key={index}
                                    className={`p-3 rounded-xl shadow-sm ${
                                        msg.isAI
                                            ? "bg-indigo-50 border border-indigo-100"
                                            : "bg-white border border-gray-100 text-right ml-auto"
                                    } max-w-[85%]`}
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
                                    <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse delay-150"></div>
                                    </div>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>
                    </ScrollArea>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 flex-none bg-white">
                        <div className="flex items-center space-x-2">
                            <Input
                                placeholder="Ask Olio about the meeting..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={isAiLoading || !meetingId}
                            />
                            <Button
                                size="sm"
                                onClick={handleSendMessage}
                                className="w-10 h-10 p-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                                disabled={isAiLoading || !message.trim() || !meetingId}
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Meeting;
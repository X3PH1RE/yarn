import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
    Phone, Mic, MicOff, Users, Monitor, Lightbulb, Send,
    Settings, MessageCircle, Volume2, VideoOff, Loader2
} from "lucide-react";

// --- DUMMY COMPONENTS (Required for standalone execution) ---
const Button = ({ children, onClick, variant, size, className, disabled }) => (
    <button 
        onClick={onClick} 
        className={`p-3 rounded-lg text-sm font-medium transition-colors duration-150 ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {children}
    </button>
);

const Input = ({ placeholder, value, onChange, onKeyPress, className, disabled }) => (
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

const ScrollArea = ({ children, className }) => (
    <div className={`overflow-y-auto ${className}`}>{children}</div>
);
// --- END DUMMY COMPONENTS ---


// --- CONFIGURATION & API HOOK ---
const API_URL = "http://localhost:8000";

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

// Hook to handle all state and API interactions for the AI/Transcription pipeline
const useMeetingPipeline = () => {
    const [audioData, setAudioData] = useState<DemoTranscriptEntry[]>([]);
    const [aiChat, setAiChat] = useState<TranscriptLine[]>([
        { user: "Olio", content: "Welcome! Click the Mic button to record your meeting idea. I'll transcribe it and give you an initial summary.", isAI: true },
    ]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Ready to record.");

    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const mediaStream = useRef<MediaStream | null>(null);
    const audioChunks = useRef<Blob[]>([]);

    // --- Audio Recording & Upload ---

    const startRecording = useCallback(async () => {
        if (isTranscribing) return;
        
        try {
            // 1. Get Microphone Permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            mediaStream.current = stream;
            
            // 2. Initialize MediaRecorder
            audioChunks.current = [];
            mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            
            mediaRecorder.current.ondataavailable = (e) => {
                audioChunks.current.push(e.data);
            };

            mediaRecorder.current.onstop = async () => {
                setStatusMessage("Recording stopped. Sending audio for transcription...");
                setIsTranscribing(true);
                
                // Convert chunks to a single Blob and then to a File
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
                
                await sendAudioForAnalysis(audioFile);
                cleanupMedia();
            };

            mediaRecorder.current.start();
            setIsTranscribing(true);
            setStatusMessage("Recording... Click mic to stop.");

        } catch (error) {
            console.error("Microphone access failed:", error);
            setStatusMessage("Error accessing mic. Check permissions or console.");
            setIsTranscribing(false);
        }
    }, [isTranscribing]);

    const stopRecording = useCallback(() => {
        if (mediaRecorder.current?.state === 'recording') {
            mediaRecorder.current.stop();
        }
    }, []);

    const cleanupMedia = () => {
        mediaStream.current?.getTracks().forEach(track => track.stop());
        mediaStream.current = null;
        setIsTranscribing(false);
    };

    const toggleMic = () => {
        if (mediaRecorder.current?.state === 'recording') { // Check if currently recording
            stopRecording();
        } else {
            startRecording();
        }
    };

    const sendAudioForAnalysis = async (audioFile: File) => {
        setIsTranscribing(true); // Keep UI busy during API call
        
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
            
            // Step 1: Update the transcript panel with the raw transcription
            setAudioData(data.full_context_list);
            
            // Step 2: Display the initial summary (AI's first response)
            setAiChat([
                ...aiChat,
                { user: "Olio", content: `Transcription complete. Summary: ${data.initial_summary}`, isAI: true }
            ]);
            
            setStatusMessage("Ready for chat.");

        } catch (error: any) {
            console.error("Audio analysis failed:", error);
            setAiChat([
                ...aiChat,
                { user: "System Error", content: `Failed to analyze audio: ${error.message}`, isAI: true }
            ]);
            setStatusMessage("Analysis failed.");
        } finally {
            setIsTranscribing(false);
        }
    };

    // --- Conversational Query Logic (Passes context back to backend) ---

    const handleAiQuery = useCallback(async (queryText: string) => {
        if (audioData.length === 0) {
            setAiChat(chat => [...chat, { user: "Olio", content: "Please record or upload audio first.", isAI: true }]);
            return;
        }

        setIsAiLoading(true);
        setAiChat(chat => [...chat, { user: "You", content: queryText, isAI: false }]);
        setStatusMessage("Querying context...");

        // Payload contains the full transcription context
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
    }, [audioData, aiChat]);

    // Cleanup effect
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
        toggleMic,
        mediaRecorderRef: mediaRecorder, // EXPOSED: Pass ref to the component
        handleAiQuery 
    };
};

// --- REACT COMPONENT ---

const Meeting = () => {
    // Dummy states for UI elements not handled by the pipeline hook
    const [message, setMessage] = useState("");
    
    const participants = [
        { id: 1, name: "Ashwin VC", isActive: true, isMuted: false },
        { id: 2, name: "Lekshmi Priya M", isActive: true, isMuted: true },
        { id: 3, name: "Austin Benny", isActive: true, isMuted: false },
        { id: 4, name: "Smitha John", isActive: false, isMuted: false },
    ];
    
    const { 
        audioData,
        aiChat, 
        isTranscribing, 
        isAiLoading, 
        statusMessage,
        toggleMic,
        mediaRecorderRef, // RECEIVE: Get the ref
        handleAiQuery 
    } = useMeetingPipeline();

    // Refs for auto-scrolling
    const chatEndRef = useRef<HTMLDivElement>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll effects
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiChat]);
    useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [audioData]);


    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const queryText = message.trim();
        if (queryText) {
            handleAiQuery(queryText);
            setMessage("");
        }
    };
    
    // FIX: Use the exposed mediaRecorderRef instead of a nonexistent variable
    const isRecording = mediaRecorderRef.current?.state === 'recording';

    const getMicButtonClass = () => {
        if (isRecording) {
            return 'bg-red-500 text-white hover:bg-red-600 animate-pulse';
        }
        if (audioData.length > 0) {
            return 'bg-green-600 text-white hover:bg-green-700'; // Finished recording/transcribing
        }
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    };

    return (
        <div className="min-h-screen bg-gray-50 flex text-gray-800" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Main Video Area */}
            <div className="flex-1 flex flex-col p-4">
                {/* Video Grid (Placeholder) */}
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
                            Meeting Transcript (File Analysis)
                            <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${isTranscribing || isRecording ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isTranscribing ? 'Processing Audio...' : isRecording ? 'Recording...' : statusMessage}
                            </span>
                        </h2>
                        <ScrollArea className="h-[calc(100%-2.5rem)]">
                            {audioData.length === 0 ? (
                                <p className="text-gray-500 italic text-sm mt-2">
                                    Record your audio idea using the mic button below to generate the transcript.
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
                    <div className="flex justify-center">
                        <div className="bg-white rounded-full px-4 py-3 shadow-xl border border-gray-100 flex items-center space-x-4">
                            <Button
                                size="lg"
                                variant="destructive"
                                className="rounded-full w-14 h-14 p-0 bg-red-700 text-white hover:bg-red-800"
                                onClick={() => alert("Ending meeting...")}
                            >
                                <Phone className="w-6 h-6" />
                            </Button>
                            
                            <Button
                                size="lg"
                                variant="secondary"
                                className={`rounded-full w-14 h-14 p-0 ${getMicButtonClass()}`}
                                onClick={toggleMic}
                                disabled={isAiLoading || isTranscribing}
                            >
                                {isTranscribing ? <Loader2 className="w-6 h-6 animate-spin" /> : (isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />)}
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
                        <span>{isAiLoading ? 'AI is thinking...' : statusMessage}</span>
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
                                    <div className="w-4 h-4 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
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
        </div>
    );
};

export default Meeting;

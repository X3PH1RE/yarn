import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Phone, Mic, MicOff, Users, Monitor, Lightbulb, Send,
    Settings, MessageCircle, Volume2, VideoOff,
} from "lucide-react";

// --- START: SHADCN/UI Mock Components (Required for single-file execution) ---

const Button = ({ children, onClick, variant, className = "", disabled, size = "md" }) => {
    let baseStyle = "font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-full";
    let variantStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";

    if (variant === "destructive") {
        variantStyle = "bg-red-500 text-white hover:bg-red-600";
    } else if (variant === "secondary") {
        variantStyle = "bg-gray-200 text-gray-700 hover:bg-gray-300";
    }

    let sizeStyle = "w-10 h-10 p-2 text-sm";
    if (size === "sm") {
        sizeStyle = "w-10 h-10 p-2 text-sm";
    } else if (size === "lg") {
        sizeStyle = "w-12 h-12 p-3 text-lg";
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyle} ${variantStyle} ${sizeStyle} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            {children}
        </button>
    );
};

const Input = ({ placeholder, value, onChange, onKeyPress, className = "", disabled }) => (
    <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyPress={onKeyPress}
        disabled={disabled}
        className={`flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yarn-purple disabled:bg-gray-100 ${className}`}
    />
);

const ScrollArea = ({ children, className = "" }) => (
    <div className={`overflow-y-auto ${className}`}>
        {children}
    </div>
);

// --- END: SHADCN/UI Mock Components ---

// --- START: AI/TRANSCRIPTION API LOGIC (Updated for FastAPI) ---

// Backend service URLs (FastAPI runs on port 8000 by default)
const API_URL = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws/transcript";

/**
 * Handles communication with the Python FastAPI backend.
 */
const useGeminiChat = (participants) => {
    const [transcript, setTranscript] = useState([]);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [aiChat, setAiChat] = useState([
        { id: 1, user: "Olio", content: "Welcome! I'm Olio, your AI assistant. Click the 'Mic' button to connect to the backend.", isAI: true },
    ]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    // WebSocket reference
    const ws = useRef(null);

    // Function to handle receiving new transcript lines
    const handleNewTranscriptLine = useCallback((line) => {
        setTranscript(t => [...t, {
            user: line.user, 
            content: line.content, 
            isAI: line.user === 'System' || line.user === 'Olio'
        }]);
        if (line.content.includes("Transcription finished")) {
            // This is triggered by the Python backend when its simulation is complete
            setIsTranscribing(false); 
        }
    }, []);

    // Function to connect/disconnect the WebSocket
    const toggleTranscription = useCallback(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            // DISCONNECT: Close the WebSocket connection
            ws.current.close();
            ws.current = null;
            setIsTranscribing(false);
            setTranscript(t => [...t, { user: "System", content: "Disconnected from backend.", isAI: false }]);
        } else {
            // CONNECT: Establish the WebSocket connection
            ws.current = new WebSocket(WS_URL);
            setIsTranscribing(true);

            ws.current.onopen = () => {
                handleNewTranscriptLine({ user: "System", content: "Successfully connected to FastAPI backend. Starting mock transcription...", isAI: false });
            };

            // Listener for real-time transcript data from the backend
            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleNewTranscriptLine(data);
                } catch (e) {
                    console.error("Failed to parse WebSocket message:", event.data);
                }
            };

            ws.current.onclose = () => {
                setIsTranscribing(false);
                setTranscript(t => [...t, { user: "System", content: "Connection closed by backend.", isAI: false }]);
            };

            ws.current.onerror = (error) => {
                console.error("WebSocket Error:", error);
                setIsTranscribing(false);
                setTranscript(t => [...t, { user: "System", content: "Connection error. Ensure FastAPI is running on port 8000.", isAI: false }]);
            };
        }
    }, [handleNewTranscriptLine]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    const handleAiQuery = async (queryText) => {
        setIsAiLoading(true);

        // 1. Add user query to chat history
        setAiChat(chat => [...chat, { user: "You", content: queryText, isAI: false }]);

        // 2. Call FastAPI REST endpoint (http://localhost:8000/api/ai/query)
        try {
            const response = await fetch(`${API_URL}/api/ai/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: queryText }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Failed to fetch AI response from backend.");
            }

            const data = await response.json();
            const aiResponse = data.response;

            // 3. Add AI response to chat history
            setAiChat(chat => [...chat, { user: "Olio", content: aiResponse, isAI: true }]);

        } catch (error) {
            setAiChat(chat => [...chat, { user: "Olio", content: `Error: ${error.message}`, isAI: true }]);
            console.error("AI Query Error:", error);
        } finally {
            setIsAiLoading(false);
        }
    };

    return { 
        transcript, isTranscribing, toggleTranscription, 
        aiChat, isAiLoading, handleAiQuery 
    };
};

// --- END: AI/TRANSCRIPTION API LOGIC ---


const Meeting = () => {
    // Component-level states for basic controls
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [message, setMessage] = useState("");
    
    // AI and Transcription logic from the custom hook
    const participants = [
        { id: 1, name: "Ashwin VC", isActive: true, isMuted: false },
        { id: 2, name: "Lekshmi Priya M", isActive: true, isMuted: true },
        { id: 3, name: "Austin Benny", isActive: true, isMuted: false },
        { id: 4, name: "Smitha John", isActive: false, isMuted: false },
    ];
    
    const { 
        transcript, isTranscribing, toggleTranscription, 
        aiChat, isAiLoading, handleAiQuery 
    } = useGeminiChat(participants);

    // Ref for auto-scrolling the chat and transcript
    const chatEndRef = useRef(null);
    const transcriptEndRef = useRef(null);

    // Auto-scroll effects
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiChat]);
    useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);


    const handleSendMessage = (e) => {
        if (e) e.preventDefault();
        const queryText = message.trim();
        if (queryText) {
            handleAiQuery(queryText);
            setMessage("");
        }
    };

    return (
        // Use a container that assumes Tailwind is loaded via CDN (as per single-file mandate)
        <div className="min-h-screen bg-gray-50 flex text-gray-800" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Main Video Area */}
            <div className="flex-1 flex flex-col p-4">
                {/* Video Grid */}
                <div className="flex-1 grid grid-cols-2 gap-4 mb-4">
                    {participants.map((participant, index) => (
                        <div
                            key={participant.id}
                            className="relative bg-gray-100 rounded-xl overflow-hidden aspect-video shadow-lg border-2 border-indigo-200/50"
                        >
                            {/* Video placeholder */}
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
                            
                            {/* User controls overlay */}
                            <div className="absolute top-2 right-2 flex items-center space-x-2">
                                {participant.isMuted && (
                                    <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                                        <MicOff className="w-3 h-3 text-white" />
                                    </div>
                                )}
                                {!participant.isActive && (
                                    <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center shadow-md">
                                        <VideoOff className="w-3 h-3 text-white" />
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
                            Live Transcription
                            <span className={`ml-2 text-xs font-normal px-2 py-0.5 rounded-full ${isTranscribing ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {isTranscribing ? 'Listening...' : 'Inactive'}
                            </span>
                        </h2>
                        <ScrollArea className="h-[calc(100%-2.5rem)]">
                            {transcript.length === 0 ? (
                                <p className="text-gray-500 italic text-sm mt-2">
                                    Start transcription using the mic button below to generate meeting context.
                                </p>
                            ) : (
                                transcript.map((line, index) => (
                                    <p key={index} className={`mb-1 text-xs ${line.user === 'System' ? 'text-orange-500 italic' : 'text-gray-700'}`}>
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
                                variant={isMuted ? "destructive" : "secondary"}
                                className={`rounded-full w-14 h-14 p-0 ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                onClick={() => setIsMuted(!isMuted)}
                            >
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </Button>

                            <Button
                                size="lg"
                                variant="secondary"
                                className="rounded-full w-14 h-14 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                onClick={toggleTranscription}
                            >
                                {isTranscribing ? <Mic className="w-6 h-6 text-indigo-600" /> : <Mic className="w-6 h-6" />}
                            </Button>

                            <Button
                                size="lg"
                                variant="secondary"
                                className={`rounded-full w-14 h-14 p-0 ${isVideoOff ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                onClick={() => setIsVideoOff(!isVideoOff)}
                                disabled
                            >
                                <VideoOff className="w-6 h-6" />
                            </Button>
                            
                            <Button
                                size="lg"
                                variant="secondary"
                                className="rounded-full w-14 h-14 p-0 bg-gray-100 text-gray-700 hover:bg-gray-200"
                                disabled
                            >
                                <Monitor className="w-6 h-6" />
                            </Button>
                            
                            <Button
                                size="lg"
                                variant="secondary"
                                className="rounded-full w-14 h-14 p-0 bg-yellow-100 hover:bg-yellow-200 shadow-md"
                                disabled
                            >
                                <Lightbulb className="w-6 h-6 text-yellow-600" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar: AI Chat */}
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-2xl">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-gray-200 flex-none">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-extrabold text-xl text-indigo-700">Meeting Tools</h3>
                        <div className="flex items-center space-x-2 text-gray-500">
                            <Button size="sm" variant="ghost" className="hover:text-indigo-600">
                                <Settings className="w-5 h-5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="hover:text-indigo-600">
                                <MessageCircle className="w-5 h-5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="hover:text-indigo-600">
                                <Users className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>
                    
                    {/* AI Status */}
                    <div className="flex items-center space-x-2 text-sm text-gray-600 bg-indigo-50 p-2 rounded-lg">
                        <Volume2 className="w-4 h-4 text-indigo-500" />
                        <span>Olio is ready to listen.</span>
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
                                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse delay-300"></div>
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
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(e)}
                                disabled={isAiLoading}
                            />
                            <Button
                                size="sm"
                                onClick={handleSendMessage}
                                className="w-10 h-10 p-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                                disabled={isAiLoading || !message.trim()}
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

// Main App component to include the necessary dependencies for a single-file executable
const App = () => (
    <>
        {/* Load Tailwind CSS */}
        <script src="https://cdn.tailwindcss.com"></script>
        {/* Define Custom Tailwind Configuration */}
        <script dangerouslySetInnerHTML={{
            __html: `
                tailwind.config = {
                    theme: {
                        extend: {
                            colors: {
                                'yarn-purple': '#6366f1',
                                'yarn-blue': '#3b82f6',
                                'yarn-dark': '#1e293b',
                                'yarn-text': '#4b5563',
                                'background': '#f9fafb',
                                'card': '#ffffff',
                                'border': '#e5e7eb',
                            }
                        }
                    }
                }
            `
        }} />
        <Meeting />
    </>
);

export default App;

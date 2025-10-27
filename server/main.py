import os
import json
import asyncio
from typing import List, Dict, Any
from datetime import datetime
import uuid

# FastAPI and dependencies
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Gemini SDK (Requires google-genai) - kept unchanged
import google.generativeai as genai
from dotenv import load_dotenv

# --- Environment Variable Setup ---
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyAQl9SQ2RCr8vTW7QHpnC09Yna8UZp-Si4")

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Yarn Audio Demo Backend",
    description="Demo API for Audio Transcription and Contextual Analysis using Gemini API.",
    version="1.0.0"
)

# --- CORS Configuration ---
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Client Initialization ---
if not GEMINI_API_KEY:
    print("FATAL ERROR: GEMINI_API_KEY is not set. AI functions will fail.")
try:
    genai.configure(api_key=GEMINI_API_KEY)
except Exception as e:
    print(f"FATAL: Gemini configuration failed: {e}")

# --- WebSocket Room Manager with direct send helper ---
class ConnectionManager:
    def __init__(self):
        # room_id -> list of connection dicts {id, name, websocket, isMuted, isActive}
        self.active_connections: Dict[str, List[Dict[str, Any]]] = {}

    async def connect(self, room_id: str, user_id: str, user_name: str, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []

        user_info = {"id": user_id, "name": user_name, "websocket": websocket, "isMuted": False, "isActive": True}
        self.active_connections[room_id].append(user_info)

        await self.broadcast(room_id, {"type": "STATUS", "message": f"{user_name} joined the room."})
        await self.send_participant_update(room_id)

    def disconnect(self, room_id: str, websocket: WebSocket):
        user_name = "Unknown"
        if room_id in self.active_connections:
            user = next((conn for conn in self.active_connections[room_id] if conn["websocket"] == websocket), None)
            if user:
                user_name = user["name"]

            self.active_connections[room_id] = [
                conn for conn in self.active_connections[room_id] if conn["websocket"] != websocket
            ]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
        return user_name

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            json_message = json.dumps(message)
            await asyncio.gather(*[
                conn["websocket"].send_text(json_message) for conn in self.active_connections[room_id]
            ])

    async def send_participant_update(self, room_id: str):
        if room_id in self.active_connections:
            participants_list = [
                {"id": conn["id"], "name": conn["name"], "isMuted": conn["isMuted"], "isActive": conn["isActive"]}
                for conn in self.active_connections[room_id]
            ]
            await self.broadcast(room_id, {"type": "PARTICIPANTS_UPDATE", "participants": participants_list})

    async def broadcast_transcript(self, room_id: str, user_name: str, text: str):
        message = {"type": "TRANSCRIPT_UPDATE", "user_name": user_name, "text": text}
        await self.broadcast(room_id, message)

    async def send_to_user(self, room_id: str, user_id: str, message: dict):
        """
        Send a message to a specific user in the room (by user_id).
        """
        if room_id not in self.active_connections:
            return False

        target = next((conn for conn in self.active_connections[room_id] if conn["id"] == user_id), None)
        if not target:
            return False

        try:
            await target["websocket"].send_text(json.dumps(message))
            return True
        except Exception as e:
            print(f"Error sending to user {user_id}: {e}")
            return False

manager = ConnectionManager()

# --- Pydantic Models for Demo (unchanged) ---
class DemoTranscriptEntry(BaseModel):
    timestamp: str
    speaker: str
    content: str

class QueryAnalysisRequest(BaseModel):
    transcript_context: List[DemoTranscriptEntry] = Field(..., description="The full transcribed audio content.")
    user_query: str = Field(..., description="The user's question about the transcript.")

# --- CORE GEMINI FUNCTIONS (unchanged) ---
async def _transcribe_audio_to_text(audio_file: UploadFile) -> str:
    print("Step 1.1: Reading audio bytes for final analysis...")
    audio_bytes = await audio_file.read()

    transcription_model = genai.GenerativeModel('gemini-2.5-flash')

    audio_part = {"mime_type": audio_file.content_type, "data": audio_bytes}

    prompt = """Listen to the audio and transcribe exactly what is spoken.
Rules:
- Return ONLY the spoken words, nothing else
- Do not add any commentary, explanations, or meta-text
- Do not say things like "The user wants" or "I will now process"
- Just output the raw transcription"""

    response = await asyncio.to_thread(
        transcription_model.generate_content,
        contents=[prompt, audio_part]
    )

    return response.text.strip()

async def get_contextual_response(full_transcript_text: str, query: str) -> str:
    analysis_model = genai.GenerativeModel('gemini-2.5-flash')

    system_prompt_instruction = (
        "You are Olio, an expert meeting analyst. Your task is to provide concise, "
        "accurate, and context-aware answers. You MUST ground your answer ONLY on the "
        "full conversation transcript provided below. Do not use external knowledge. "
        "If the answer is not explicitly stated in the transcript, state that clearly."
    )

    user_prompt = (
        f"INSTRUCTION: {system_prompt_instruction}\n\n"
        f"MEETING TRANSCRIPT:\n---\n{full_transcript_text}\n---\n\n"
        f"USER QUERY: {query}"
    )

    response = await asyncio.to_thread(
        analysis_model.generate_content,
        contents=[user_prompt]
    )

    return response.text.strip()

# --- API Endpoints (unchanged) ---
@app.post("/api/demo/analyze-audio", tags=["Demo - Audio Upload"])
async def analyze_audio_demo(audio_file: UploadFile = File(...)):
    if audio_file.content_type not in ["audio/mp3", "audio/wav", "audio/mpeg", "audio/webm"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a common audio file (mp3, wav, etc.).")

    try:
        final_transcript_text = await _transcribe_audio_to_text(audio_file)

        transcribed_context = [
            DemoTranscriptEntry(
                timestamp=datetime.now().strftime("%H:%M:%S"),
                speaker="Transcription",
                content=final_transcript_text
            )
        ]

        initial_query = "Provide a concise summary of this meeting transcript. What is the main action item?"
        initial_analysis = await get_contextual_response(final_transcript_text, initial_query)

        return {
            "filename": audio_file.filename,
            "transcription_status": "Complete",
            "transcribed_text": final_transcript_text,
            "initial_summary": initial_analysis,
            "full_context_list": transcribed_context,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during audio processing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process audio file: Gemini API Error. Check your model name or API key.")

@app.post("/api/demo/query-analysis", tags=["Demo - Audio Upload"])
async def query_analysis_demo(request: QueryAnalysisRequest):
    if not request.user_query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    full_transcript_text = "\n".join([f"[{entry.speaker}]: {entry.content}" for entry in request.transcript_context])

    if not full_transcript_text.strip():
        raise HTTPException(status_code=400, detail="Context is empty. Please run the transcription session first.")

    try:
        analysis_result = await get_contextual_response(full_transcript_text, request.user_query)

        return JSONResponse(content={"analysis_result": analysis_result})

    except Exception as e:
        print(f"Error during query analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to perform query analysis: {e}")

@app.get("/status", tags=["Utility"])
def get_status():
    return {"status": "ok", "message": "Demo server running."}

# --- WebSocket endpoint with signaling (offer/answer/ice) + existing transcript routing ---
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str = "", user_name: str = ""):
    user_name = user_name or "Guest"
    await manager.connect(room_id, user_id, user_name, websocket)

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)

            # Live speech text broadcast (existing)
            if message.get("type") == "SPEECH_INPUT":
                text = message.get("text")
                sender_name = message.get("user_name")
                if text and sender_name:
                    await manager.broadcast_transcript(room_id, sender_name, text)
                continue

            # Participant chat messages
            if message.get("type") == "CHAT_MESSAGE":
                chat_text = message.get("text")
                sender_id = message.get("sender_id")
                sender_name = message.get("sender_name")
                if chat_text and sender_id and sender_name:
                    await manager.broadcast(room_id, {
                        "type": "CHAT_MESSAGE",
                        "sender_id": sender_id,
                        "sender_name": sender_name,
                        "text": chat_text,
                        "timestamp": datetime.now().strftime("%H:%M:%S")
                    })
                continue

            # Signaling messages: offer, answer, ice-candidate
            mtype = message.get("type")
            if mtype in ("offer", "answer", "ice-candidate"):
                # Expect 'to' field (target user id) and 'from' field (sender user id)
                target_id = message.get("to")
                sender_id = message.get("from")
                payload = message.copy()
                # For security/robustness, ensure target exists
                if target_id:
                    # Route to specific user
                    sent = await manager.send_to_user(room_id, target_id, payload)
                    if not sent:
                        # optionally reply with an error back to sender
                        try:
                            await websocket.send_text(json.dumps({"type": "ERROR", "message": f"Target {target_id} not found."}))
                        except:
                            pass
                else:
                    # Broadcast fallback if no target specified
                    await manager.broadcast(room_id, payload)
                continue

            # Participant commands: e.g., mute/unmute toggle (optional)
            if mtype == "UPDATE_STATUS":
                # Example: { type: "UPDATE_STATUS", user_id: "...", isMuted: true }
                target_id = message.get("user_id")
                is_muted = message.get("isMuted")
                if room_id in manager.active_connections:
                    for conn in manager.active_connections[room_id]:
                        if conn["id"] == target_id:
                            conn["isMuted"] = bool(is_muted)
                    await manager.send_participant_update(room_id)
                continue

            # Unknown message types can be logged or broadcast
            # For debugging, we broadcast unknown messages to all participants
            await manager.broadcast(room_id, {"type": "UNKNOWN", "payload": message})

    except WebSocketDisconnect:
        user_name_disconnected = manager.disconnect(room_id, websocket)
        print(f"{user_name_disconnected} left room {room_id}")
        await manager.broadcast(room_id, {"type": "STATUS", "message": f"{user_name_disconnected} left the room."})
        await manager.send_participant_update(room_id)
    except Exception as e:
        print(f"An error occurred with user {user_name} in room {room_id}: {e}")
        manager.disconnect(room_id, websocket)
        await manager.send_participant_update(room_id)

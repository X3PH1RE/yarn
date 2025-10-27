import os
import json
import asyncio
from typing import List, Dict, Any
from datetime import datetime
import re
import uuid
import io

# FastAPI and dependencies
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Gemini SDK (Requires google-genai)
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv

# --- Environment Variable Setup ---
load_dotenv()
GEMINI_API_KEY = "AIzaSyAQl9SQ2RCr8vTW7QHpnC09Yna8UZp-Si4"

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Yarn Audio Demo Backend",
    description="Demo API for Audio Transcription and Contextual Analysis using Gemini API.",
    version="1.0.0"
)

# --- CORS Configuration ---
origins = ["*"] # Allow all for local demo testing
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

# --- NEW: WebSocket Room Manager (UNCHANGED) ---

class ConnectionManager:
    def __init__(self):
        # Dictionary to hold active connections per room: {room_id: [{user_id, user_name, websocket}]}
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
            # Find the user name before disconnecting
            user = next((conn for conn in self.active_connections[room_id] if conn["websocket"] == websocket), None)
            if user:
                user_name = user["name"]
            
            # Find and remove the user by WebSocket object
            self.active_connections[room_id] = [
                conn for conn in self.active_connections[room_id] if conn["websocket"] != websocket
            ]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
        return user_name

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            json_message = json.dumps(message)
            # Use asyncio.wait for concurrent sending
            await asyncio.gather(*[
                conn["websocket"].send_text(json_message) for conn in self.active_connections[room_id]
            ])
            
    async def send_participant_update(self, room_id: str):
        if room_id in self.active_connections:
            # Prepare the list of participants (excluding the websocket object)
            participants_list = [
                {"id": conn["id"], "name": conn["name"], "isMuted": conn["isMuted"], "isActive": conn["isActive"]}
                for conn in self.active_connections[room_id]
            ]
            await self.broadcast(room_id, {"type": "PARTICIPANTS_UPDATE", "participants": participants_list})

manager = ConnectionManager()

# --- Pydantic Models for Demo (UNCHANGED) ---

class DemoTranscriptEntry(BaseModel):
    timestamp: str
    speaker: str 
    content: str

class QueryAnalysisRequest(BaseModel):
    transcript_context: List[DemoTranscriptEntry] = Field(..., description="The full transcribed audio content.")
    user_query: str = Field(..., description="The user's question about the transcript.")


# --- CORE GEMINI FUNCTIONS (UNCHANGED) ---

async def _transcribe_audio_to_text(audio_file: UploadFile) -> str:
    print("Step 1.1: Reading audio bytes...")
    audio_bytes = await audio_file.read()
    
    transcription_model = genai.GenerativeModel('gemini-2.5-flash')
    
    audio_part = {"mime_type": audio_file.content_type, "data": audio_bytes}
    
    print(f"Step 1.2: Sending {audio_file.filename} to Gemini for transcription...")
    
    response = await asyncio.to_thread(
        transcription_model.generate_content,
        contents=["Transcribe the audio and return ONLY the raw spoken text.", audio_part]
    )
    
    print("Step 1.3: Transcription received.")
    return response.text.strip()


async def get_contextual_response(full_transcript_text: str, query: str) -> str:
    analysis_model = genai.GenerativeModel('gemini-2.5-flash')
    
    system_prompt_instruction = (
        "You are Olio, an expert meeting analyst. Your task is to provide concise, "
        "accurate, and context-aware answers. You MUST ground your answer ONLY on the "
        "meeting transcript provided below. Do not use external knowledge. "
        "If the answer is not explicitly stated in the transcript, state that clearly."
    )
    
    user_prompt = (
        f"INSTRUCTION: {system_prompt_instruction}\n\n"
        f"MEETING TRANSCRIPT:\n---\n{full_transcript_text}\n---\n\n"
        f"USER QUERY: {query}"
    )
    
    print(f"Step 2.1: Sending context ({len(full_transcript_text)} chars) and query to Gemini for analysis...")

    response = await asyncio.to_thread(
        analysis_model.generate_content,
        contents=[user_prompt]
    )
    
    print("Step 2.2: Analysis received.")
    return response.text.strip()


# --- API Endpoints (UNCHANGED) ---

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
        
    full_transcript_text = "\n".join([entry.content for entry in request.transcript_context])
    
    if not full_transcript_text.strip():
        raise HTTPException(status_code=400, detail="Context is empty. Please upload an audio file first.")

    try:
        analysis_result = await get_contextual_response(full_transcript_text, request.user_query)
        
        return JSONResponse(content={"analysis_result": analysis_result})
        
    except Exception as e:
        print(f"Error during query analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to perform query analysis: {e}")


@app.get("/status", tags=["Utility"])
def get_status():
    return {"status": "ok", "message": "Demo server running."}


# NEW ENDPOINT: WebSocket for Signaling/Room Presence (UNCHANGED)
@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str, user_name: str):
    user_name = user_name or "Guest"
    
    await manager.connect(room_id, user_id, user_name, websocket)
    
    try:
        while True:
            # This loop keeps the connection alive
            data = await websocket.receive_text()
            print(f"Received message from {user_name} in {room_id}: {data}")

    except WebSocketDisconnect:
        user_name_disconnected = manager.disconnect(room_id, websocket)
        print(f"{user_name_disconnected} left room {room_id}")
        await manager.broadcast(room_id, {"type": "STATUS", "message": f"{user_name_disconnected} left the room."})
        await manager.send_participant_update(room_id)
    except Exception as e:
        print(f"An error occurred with user {user_name} in room {room_id}: {e}")
        manager.disconnect(room_id, websocket)
        await manager.send_participant_update(room_id)
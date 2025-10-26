import os
import json
import asyncio
from typing import List, Dict, Any
from datetime import datetime
import re
import uuid
import io

# FastAPI and dependencies
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
# FIX: Corrected import casing from 'CORSMiddleware' to 'CORSMiddleware'
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
# The class used here (CORSMiddleware) is now correctly imported above.
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


# --- Pydantic Models for Demo ---

# Model for a single mock transcript entry (timestamp is simple string here)
class DemoTranscriptEntry(BaseModel):
    timestamp: str
    speaker: str # Added for structural completeness
    content: str

# Model for the incoming query with full context (used by the client for follow-up questions)
class QueryAnalysisRequest(BaseModel):
    transcript_context: List[DemoTranscriptEntry] = Field(..., description="The full transcribed audio content.")
    user_query: str = Field(..., description="The user's question about the transcript.")


# --- CORE GEMINI FUNCTIONS ---

async def _transcribe_audio_to_text(audio_file: UploadFile) -> str:
    """
    FUNCTION 1 (Transcription): Sends audio file to Gemini for transcription.
    Returns the raw text.
    """
    print("Step 1.1: Reading audio bytes...")
    audio_bytes = await audio_file.read()
    
    # Using the most reliable model for multimodal file processing
    transcription_model = genai.GenerativeModel('gemini-2.5-flash')
    
    audio_part = {"mime_type": audio_file.content_type, "data": audio_bytes}
    
    # Send the audio part along with the instruction
    print(f"Step 1.2: Sending {audio_file.filename} to Gemini for transcription...")
    
    # Use asyncio.to_thread to run synchronous SDK method safely in FastAPI's thread pool
    response = await asyncio.to_thread(
        transcription_model.generate_content,
        contents=["Transcribe the audio and return ONLY the raw spoken text.", audio_part]
    )
    
    print("Step 1.3: Transcription received.")
    return response.text.strip()


async def get_contextual_response(full_transcript_text: str, query: str) -> str:
    """
    FUNCTION 2 (Analysis): Sends the full transcript text and user query to Gemini for analysis.
    Returns the final conversational answer.
    """
    
    # This model name was already correct for analysis
    analysis_model = genai.GenerativeModel('gemini-2.5-flash')
    
    system_prompt_instruction = (
        "You are Olio, an expert meeting analyst. Your task is to provide concise, "
        "accurate, and context-aware answers. You MUST ground your answer ONLY on the "
        "meeting transcript provided below. Do not use external knowledge. "
        "If the answer is not explicitly stated in the transcript, state that clearly."
    )
    
    user_prompt = (
        f"INSTRUCTION: {system_prompt_instruction}\n\n" # Inject system instruction into the prompt
        f"MEETING TRANSCRIPT:\n---\n{full_transcript_text}\n---\n\n"
        f"USER QUERY: {query}"
    )
    
    print(f"Step 2.1: Sending context ({len(full_transcript_text)} chars) and query to Gemini for analysis...")

    # Use asyncio.to_thread to run synchronous SDK method safely in FastAPI's thread pool
    response = await asyncio.to_thread(
        analysis_model.generate_content,
        contents=[user_prompt]
    )
    
    print("Step 2.2: Analysis received.")
    return response.text.strip()


# --- API Endpoints ---

@app.post("/api/demo/analyze-audio", tags=["Demo - Audio Upload"])
async def analyze_audio_demo(audio_file: UploadFile = File(...)):
    """
    Endpoint 1: Uploads an audio file, transcribes it using Gemini, and returns the raw text 
    and an initial summary.
    """
    if audio_file.content_type not in ["audio/mp3", "audio/wav", "audio/mpeg", "audio/webm"]:
         raise HTTPException(status_code=400, detail="Invalid file type. Please upload a common audio file (mp3, wav, etc.).")
    
    try:
        # Step 1: Transcribe the audio (using Function 1)
        final_transcript_text = await _transcribe_audio_to_text(audio_file)

        # Step 2: Prepare context for follow-up query
        transcribed_context = [
            DemoTranscriptEntry(
                timestamp=datetime.now().strftime("%H:%M:%S"),
                speaker="Transcription",
                content=final_transcript_text
            )
        ]
        
        # Step 3: Run initial summary (using Function 2)
        initial_query = "Provide a concise summary of this meeting transcript. What is the main action item?"
        initial_analysis = await get_contextual_response(final_transcript_text, initial_query)

        return {
            "filename": audio_file.filename,
            "transcription_status": "Complete",
            "transcribed_text": final_transcript_text, # Raw text for follow-up query context
            "initial_summary": initial_analysis,        # First answer for display
            "full_context_list": transcribed_context,   # List format for /query-analysis endpoint
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during audio processing: {e}")
        # Return a clear message if the model call failed
        raise HTTPException(status_code=500, detail=f"Failed to process audio file: Gemini API Error. Check your model name or API key.")


@app.post("/api/demo/query-analysis", tags=["Demo - Audio Upload"])
async def query_analysis_demo(request: QueryAnalysisRequest):
    """
    Endpoint 2: Takes the full transcribed text context and a new user question, 
    then sends both to Gemini for dynamic conversation.
    """
    if not request.user_query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    # Reconstruct the single, continuous transcription text from the context list
    full_transcript_text = "\n".join([entry.content for entry in request.transcript_context])
    
    if not full_transcript_text.strip():
        raise HTTPException(status_code=400, detail="Context is empty. Please upload an audio file first.")

    try:
        # Step 1: Send the continuous text and the new query for contextual analysis (using Function 2)
        analysis_result = await get_contextual_response(full_transcript_text, request.user_query)
        
        return JSONResponse(content={"analysis_result": analysis_result})
        
    except Exception as e:
        print(f"Error during query analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to perform query analysis: {e}")


@app.get("/status", tags=["Utility"])
def get_status():
    """Simple health check endpoint."""
    return {"status": "ok", "message": "Demo server running."}

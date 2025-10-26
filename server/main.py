import asyncio
import os
from contextlib import asynccontextmanager
from typing import List, Dict

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware  # <-- FIXED TYPO HERE
from pydantic import BaseModel, Field

# --- CONFIGURATION & SETUP ---

# Use your actual API key here. Leave it as "MOCK_KEY_REPLACE_ME" if you want to use the mock client.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "MOCK_KEY_REPLACE_ME")

# In-memory store to simulate a database containing the full transcript
TRANSCRIPT_STORE: List[Dict[str, str]] = []

# --- MOCK GEMINI CLIENT ---

class MockGeminiClient:
    """Simulates the Gemini API client for local testing and data flow validation."""
    def __init__(self, api_key: str):
        self.is_mock = api_key == "MOCK_KEY_REPLACE_ME"

    async def generate_content(self, system_prompt: str, user_prompt: str) -> str:
        """Mocks the asynchronous API call with contextual responses."""
        await asyncio.sleep(0.5) # Simulate network latency
        
        # Simple analysis of the user prompt to return contextual mock responses
        lower_prompt = user_prompt.lower()
        
        if "deployment" in lower_prompt or "vercel" in lower_prompt:
            return "The team agreed on a two-part deployment strategy: **React on Vercel** for the frontend, and the **Python backend** as a separate API service to securely manage Deepgram and Gemini calls."
        elif "who was speaking" in lower_prompt or "participants" in lower_prompt:
            return "The speakers identified in the provided context were Ashwin VC, Lekshmi Priya M, and Austin Benny."
        elif "summarize" in lower_prompt:
            return "The meeting summary is that the team finalized the architecture: Vercel for the React frontend, and a dedicated Python service for the AI and real-time APIs."
        else:
            return "Mock AI Response: Your query has been successfully processed by the simulated AI. This confirms the API endpoint is working correctly."

GEMINI_CLIENT = MockGeminiClient(GEMINI_API_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pre-populate TRANSCRIPT_STORE for direct REST testing
    global TRANSCRIPT_STORE
    TRANSCRIPT_STORE = [
        {"user": "Ashwin VC", "content": "Okay, let's start the weekly project sync. The main goal today is to finalize the deployment strategy."},
        {"user": "Lekshmi Priya M", "content": "I've been looking into serverless options. Vercel seems like the most straightforward choice for our React frontend."},
        {"user": "Austin Benny", "content": "We need the Python layer to handle Deepgram and Gemini API calls securely. Final decision is: React on Vercel, Python backend as a separate API service."},
    ]
    print(f"FastAPI started. Transcript store pre-populated with {len(TRANSCRIPT_STORE)} lines for direct testing.")
    yield
    print("FastAPI server shutting down...")

app = FastAPI(
    title="Yarn AI Meeting Backend",
    version="1.0.0",
    description="FastAPI service for Deepgram Transcription and Gemini AI context.",
    lifespan=lifespan
)

# Configure CORS (Essential for React to communicate with FastAPI locally)
origins = ["*",] 
app.add_middleware(
    CORSMiddleware, # <-- CORRECTED HERE
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---

class AIQueryRequest(BaseModel):
    query: str = Field(..., description="The user's question about the transcript.")

class AIQueryResponse(BaseModel):
    response: str = Field(..., description="The AI's context-aware answer.")

# --- CORE AI CALL FUNCTION ---

async def get_gemini_response(full_transcript: List[Dict[str, str]], query: str) -> str:
    """Constructs the prompt and calls the (mocked/real) Gemini client."""
    context_lines = [f"{item['user']}: {item['content']}" for item in full_transcript]
    full_context = "\n".join(context_lines)
    
    system_prompt = (
        "You are Olio, an AI meeting assistant. Your task is to provide concise, "
        "context-aware answers based ONLY on the provided meeting transcript. "
        "Do not invent information. If the answer is not in the transcript, state that clearly."
    )
    
    user_prompt = (
        f"MEETING TRANSCRIPT CONTEXT:\n---\n{full_context}\n---\n\n"
        f"USER QUERY: {query}"
    )
    
    return await GEMINI_CLIENT.generate_content(system_prompt, user_prompt)

# --- ENDPOINTS ---

@app.websocket("/ws/transcript")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print(f"Client connected for transcription: {websocket.client}")

    try:
        dialogue = [
            {"user": "Ashwin VC", "content": "Okay, let's start the weekly project sync. The main goal today is to finalize the deployment strategy."},
            {"user": "Lekshmi Priya M", "content": "I've been looking into serverless options. Vercel seems like the most straightforward choice for our React frontend."},
            {"user": "Austin Benny", "content": "We need the Python layer to handle Deepgram and Gemini API calls securely. Final decision is: React on Vercel, Python backend as a separate API service."},
            {"user": "Ashwin VC", "content": "Agreed. The final decision is: React on Vercel, Python backend as a separate API service."},
        ]
        
        global TRANSCRIPT_STORE
        TRANSCRIPT_STORE.clear()
        
        await websocket.send_json({"user": "System", "content": "Transcription simulation started on backend.", "is_ai": False})

        for item in dialogue:
            await asyncio.sleep(1) 
            if item["user"] != "System":
                TRANSCRIPT_STORE.append(item)
            await websocket.send_json({"user": item["user"], "content": item["content"], "is_ai": False})
            
        await websocket.send_json({"user": "System", "content": "Transcription finished. Context available for AI query.", "is_ai": False})

        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        print(f"Client disconnected: {websocket.client}")
    except Exception as e:
        print(f"WebSocket Error: {e}")
        await websocket.close()
    finally:
        print("WebSocket closed.")

@app.post("/api/ai/query", response_model=AIQueryResponse)
async def ai_query_handler(request: AIQueryRequest):
    """Handles the user's conversational query about the transcript using the live store."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    full_transcript = TRANSCRIPT_STORE
    
    if not full_transcript:
        return AIQueryResponse(response="I cannot answer yet. The meeting transcript context is currently empty. Run the transcription first.")

    try:
        ai_response = await get_gemini_response(full_transcript, request.query)
        return AIQueryResponse(response=ai_response)
    except Exception as e:
        # If this fires, check the Uvicorn terminal for the full traceback
        print(f"AI Query Error: {e}") 
        raise HTTPException(status_code=500, detail="Error communicating with the AI service.")


@app.post("/api/ai/test-gemini", response_model=AIQueryResponse, summary="Test Gemini Context Call Directly")
async def test_gemini_handler(request: AIQueryRequest):
    """Allows direct testing of the Gemini integration logic using a small, fixed transcript."""
    # This transcript is for testing this endpoint specifically, separate from the live store
    test_transcript = [
        {"user": "John", "content": "We decided to move forward with the purple color scheme."},
        {"user": "Jane", "content": "We set the budget at $10,000 for the first month."},
    ]
    
    try:
        ai_response = await get_gemini_response(test_transcript, request.query)
        return AIQueryResponse(response=ai_response)
    except Exception as e:
        print(f"AI Test Endpoint Failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI Test Failed: {e}")

@app.get("/status")
def get_status():
    """Simple health check endpoint."""
    return {"status": "ok", "transcript_count": len(TRANSCRIPT_STORE)}
import os
import sys
import time
import threading
import webbrowser
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

# Load .env file for local development
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Import the Google GenAI SDK
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("FATAL ERROR: Please install requirements using: pip install -r requirements.txt")
    sys.exit(1)

app = FastAPI(title="Portia AI Assistant Backend", version="0.1")

# Get Port from environment, falling back to 5000 for local runs
PORT = int(os.environ.get("PORT", 5000))

# Pydantic schemas for /chat route
class PartInput(BaseModel):
    text: str

class MessageInput(BaseModel):
    role: str
    parts: List[PartInput]

class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's latest incoming text message")
    history: List[MessageInput] = Field(default_factory=list, description="Array of past user/model turns")

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Verify API Key is available
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return JSONResponse(
            status_code=400,
            content={
                "error": "Missing GEMINI_API_KEY environment variable. Let the user know they need to set up their API key in Settings > Secrets or in the local .env."
            }
        )

    try:
        # Initialize Google GenAI client
        # In the modern SDK, client is initialized with the api_key and custom HTTP Headers for telemetry
        client = genai.Client(
            api_key=api_key,
            http_options={"headers": {"User-Agent": "aistudio-build"}}
        )

        # Build content list representing the dialogue history
        contents = []
        for turn in request.history:
            # map turn types to modern SDK Content objects
            parts_list = []
            for p in turn.parts:
                parts_list.append(types.Part.from_text(text=p.text))
            
            contents.append(
                types.Content(
                    role=turn.role,
                    parts=parts_list
                )
            )

        # Append the new message turn
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=request.message)]
            )
        )

        # Call the Gemini model. We use the latest stable flash models like gemini-2.5-flash
        # or the requested gemini-2.0-flash (works seamlessly on standard Python SDK)
        # We will use gemini-2.5-flash as default, or fall back to gemini-2.0-flash per prompt
        model_name = "gemini-2.5-flash"  # Latest stable flash model recommended for text tasks
        
        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction="You are Portia, a helpful and friendly personal voice AI assistant. Keep responses sweet, concise, and dynamic, as they will be read aloud."
            )
        )

        reply_text = response.text or "I was unable to formulate a response."
        return {"reply": reply_text}

    except Exception as e:
        # Gracefully catch Rate Limits, Network failures and API Key errors without stopping FastAPI
        print(f"Gemini API Error occurred: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Gemini API Error: {str(e)}"
            }
        )

# Serve the static frontend index.html
# Mount the static directory for index.html or fallback direct serving
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def root_endpoint():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    else:
        return HTMLResponse(
            content="<h3>Portia frontend static/index.html not found! Please verify folder structures.</h3>",
            status_code=404
        )

# Helper function to auto-launch the browser only for local runs
def launch_browser():
    # Only launch when PORT is not explicitly set in the env (e.g. cloud host)
    if "PORT" not in os.environ:
        time.sleep(1.5)  # Let the uvicorn worker launch first
        local_url = f"http://localhost:{PORT}"
        print(f"🚀 [Local Dev] Auto-launching Portia in your default browser: {local_url}")
        webbrowser.open(local_url)

if __name__ == "__main__":
    import uvicorn
    
    # Start auto-browser in background thread
    threading.Thread(target=launch_browser, daemon=True).start()
    
    print(f"Starting Portia backend server on http://0.0.0.0:{PORT}...")
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=False)

# Portia v0.1 — Personal Voice AI Assistant (MVP)

Portia is a minimal, elegant personal AI assistant designed to run locally or be hosted on cloud servers such as Render. It features a dark-themed responsive chat interface supporting real-time text chat, voice input (speech transcription), and voice output synthesis (repeating response spoken text).

## Features
- 🎙️ **Voice Input**: Continuous voice transcription using the browser's Web Speech API (`SpeechRecognition`).
- 🗣️ **Voice Output**: Speaks Gemini's replies aloud using the browser's `speechSynthesis` API, including a mute toggle control.
- ⚡ **Gemini Integration**: Calls the Google Gemini API (`gemini-2.5-flash`) streamingly with session-based context.
- 📱 **Mobile Responsive**: Scalable dark slate/indigo theme with layout optimized for desktops, tablets, and mobile (Android/iOS) screens.
- 🛡️ **Session Context**: Automatically preserves the previous ~20 messages in browser active session memory (clears on page refresh).

---

## File Structure
```
portia/
├── server.py             # FastAPI Python Server config
├── .env                  # GEMINI_API_KEY (gitignored - created locally)
├── .gitignore            # Gitignore to avoid uploading credentials
├── requirements.txt      # Python dependencies
└── static/
    └── index.html        # Modern text & voice chatbot frontend UI
```

---

## Local Development Setup

Follow these steps to run Portia on your local machine:

1. **Clone or copy** the `portia/` directory to your computer.
2. **Setup virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```
3. **Install Requirements**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Configure your API Key**:
   Create a `.env` file in the `portia/` root folder and insert your Gemini API Key:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```
5. **Run the backend**:
   ```bash
   python server.py
   ```
6. **Autolaunch**: Since you are running locally without specifying a `PORT` environment variable, the script will automatically launch `http://localhost:5000` in your default web browser!

---

## Deploying to Render (Free Web Service)

Portia's FastAPI backend is pre-configured to build and deploy to **Render.com** free-tier server instances instantly. Follow these deployment instructions:

### Step 1: Push your files to GitHub
1. Create a personal repository on your GitHub account named `portia`.
2. Initialize Git inside your local `portia/` directory:
   ```bash
   git init
   git add .
   git commit -m "Initialize Portia v0.1 MVP"
   ```
3. Link and push to your GitHub remote repository:
   ```bash
   git remote add origin https://github.com/<your-username>/portia.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Set up a Web Service on Render
1. Create a free account at [Render.com](https://render.com).
2. Go to your **Render Dashboard** and click **New > Web Service**.
3. Connect your GitHub account and select your `portia` repository.
4. Configure the Web Service settings as follows:
   - **Name**: `portia-assistant` (or any name you like)
   - **Region**: Select the closest region to you (e.g., Oregon or Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: **Free** ($0/month, 750 free hours)

### Step 3: Add Environments variables
1. In the Web Service creation page (or in the service page's **Environment** tab later):
2. Click **Add Environment Variable**.
3. Set **Key** to: `GEMINI_API_KEY`
4. Set **Value** to: `(your actual Google Gemini API Key)`
5. Click **Deploy Web Service** at the bottom!

---

## Render Free Tier Considerations

> [!NOTE]
> Render's **Free Web Service** tier automatically **spins down/sleeps** if your assistant has had no visitors/requests for **15 minutes**. 
> - If you revisit the app and send a message after a sleep gap, the first request will take **30 to 60 seconds** to wake up and respond.
> - This is a normal budget restriction on Render Free services and does not indicate a code bug. Once awake, performance returns to instant speed.

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Bot, 
  User, 
  HelpCircle, 
  AlertTriangle,
  RefreshCw,
  Sparkles
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "model";
  text: string;
  isError?: boolean;
}

interface HistoryItem {
  role: "user" | "model";
  parts: { text: string }[];
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "model",
      text: "Hi, I'm Portia. Speak to me by clicking the microphone button or type your message below. I will translate, reply, and read my responses aloud to you!"
    }
  ]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [compatWarning, setCompatWarning] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Portia ready");
  const [audioStatus, setAudioStatus] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Check Web Speech API Support
  useEffect(() => {
    const SpeechRecognition = 
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setCompatWarning("ভয়েস ফিচার শুধু Chrome/Edge-এ কাজ করবে (Web Speech API not supported)");
    } else {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setStatusText("Listening...");
      };

      rec.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setUserInput(transcript);
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setStatusText(`Speech Error: ${event.error}`);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setStatusText("Portia done listening");
      };

      recognitionRef.current = rec;
    }
  }, []);

  // Handle auto-send toggle reaction after transcription ends
  useEffect(() => {
    if (!isListening && autoSend && userInput.trim() !== "") {
      handleSubmit();
    }
  }, [isListening]);

  // Scroll to bottom whenever messages list grows
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle Synthesis Voice Reading
  const speakResponse = (text: string) => {
    if (isMuted || !window.speechSynthesis) return;

    // Remove markdown symbols and action thoughts in parentheses so TTS reads flawlessly
    const cleanText = text
      .replace(/[\*\#\_\~`>\[\]\(\)]/g, "")
      .replace(/\(.*?\)/g, "")
      .trim();

    window.speechSynthesis.cancel(); // Stop playing pre-existing speech audio

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Locate preferred natural English voice
    const voices = window.speechSynthesis.getVoices();
    const preferableVoice = voices.find(
      v => v.name.includes("Google US English") || v.name.includes("Microsoft Zira") || v.lang === "en-US"
    );
    if (preferableVoice) {
      utterance.voice = preferableVoice;
    }

    utterance.onstart = () => setAudioStatus("🗣️ Speaking...");
    utterance.onend = () => setAudioStatus("");
    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      setAudioStatus("");
    };

    window.speechSynthesis.speak(utterance);
  };

  // Toggle Microphone
  const handleMicToggle = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis.cancel(); // Silence current voice output
      setUserInput("");
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Error starting speech recognition:", err);
      }
    }
  };

  // Handle Text Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = userInput.trim();
    if (text === "" || isLoading) return;

    setUserInput("");
    window.speechSynthesis.cancel(); // Mute ongoing audio playback on new input

    // Keep unique message id
    const userMsgId = Date.now().toString() + "-user";
    const userMsg: Message = { id: userMsgId, sender: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStatusText("Portia is thinking...");

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history
        })
      });

      if (!response.ok) {
        const errObj = await response.json().catch(() => ({}));
        throw new Error(errObj.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setIsLoading(false);
      setStatusText("Portia ready");

      if (data.error) {
        const errId = Date.now().toString() + "-err";
        setMessages(prev => [...prev, { id: errId, sender: "model", text: data.error, isError: true }]);
        speakResponse("Error: " + data.error);
      } else {
        const reply = data.reply;
        const replyId = Date.now().toString() + "-ai";
        setMessages(prev => [...prev, { id: replyId, sender: "model", text: reply }]);
        
        // Append history for multi-turn sessions (up to 20 messages limit)
        const updatedHistory: HistoryItem[] = [
          ...history,
          { role: "user", parts: [{ text }] },
          { role: "model", parts: [{ text: reply }] }
        ];
        
        // Truncate past 20 list bounds
        setHistory(updatedHistory.slice(-20));
        speakResponse(reply);
      }

    } catch (err: any) {
      setIsLoading(false);
      setStatusText("Error occurred");
      const errId = Date.now().toString() + "-err";
      setMessages(prev => [
        ...prev, 
        { 
          id: errId, 
          sender: "model", 
          text: `Could not reach Portia backend. Error details: ${err.message}. Please verify the backend is running properly.`, 
          isError: true 
        }
      ]);
      speakResponse("Connection failed");
    }
  };

  // Toggle Mute Output
  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      window.speechSynthesis.cancel();
      setAudioStatus("Muted");
    } else {
      setAudioStatus("");
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100 font-sans">
      
      {/* Header Container */}
      <header className="border-b border-slate-800 bg-slate-900 px-6 py-4 flex items-center justify-between shrink-0 z-10 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <span className="block w-3.5 h-3.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="absolute top-0 left-0 block w-3.5 h-3.5 bg-emerald-500 rounded-full animate-ping opacity-75"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Portia</h1>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-bold">
                Live Preview
              </span>
            </div>
            <p className="text-xs text-slate-400">Personal Voice AI Assistant (v0.1 MVP)</p>
          </div>
        </div>

        {/* Toggles & Options */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handleMuteToggle}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 transition duration-200 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span className="hidden sm:inline">
              {isMuted ? "Voiceless" : "Voice Output"}
            </span>
          </button>

          <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1.5 rounded-lg text-sm text-slate-300 font-medium select-none">
            <label htmlFor="auto-send-toggle" className="cursor-pointer">
              Auto-send
            </label>
            <input
              type="checkbox"
              id="auto-send-toggle"
              checked={autoSend}
              onChange={(e) => setAutoSend(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-700 border-slate-600 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </header>

      {/* Warning banner */}
      {compatWarning && (
        <div className="bg-amber-950/40 border-b border-amber-900 px-6 py-2.5 text-xs sm:text-sm text-amber-200 flex items-center justify-between shrink-0 animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
            <span>{compatWarning}</span>
          </div>
          <button 
            onClick={() => setCompatWarning(null)} 
            className="text-amber-400 hover:text-white font-bold leading-none px-2 py-0.5 rounded-md hover:bg-slate-800/50"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Chat Feed */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950 flex flex-col">
        <div className="flex-1 w-full max-w-3xl mx-auto space-y-6">
          
          {/* Main prompt-style widget container */}
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id || Math.random()}
                className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-sm text-indigo-400 shrink-0 shadow-md">
                    <Bot size={18} />
                  </div>
                )}
                
                <div
                  className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm transition-all duration-300 ${
                    isUser
                      ? "bg-indigo-600/20 border border-indigo-500/20 text-indigo-100 rounded-tr-none"
                      : msg.isError
                        ? "bg-red-950/40 border border-red-900/50 text-red-200 rounded-tl-none"
                        : "bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  
                  {/* Repeat sound button if AI replies */}
                  {!isUser && !msg.isError && window.speechSynthesis && (
                    <button
                      onClick={() => speakResponse(msg.text)}
                      className="text-xs mt-2 text-slate-500 hover:text-indigo-400 font-medium transition duration-200 flex items-center gap-1 focus:outline-none"
                    >
                      <Volume2 size={12} />
                      Read Aloud
                    </button>
                  )}
                </div>

                {isUser && (
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md">
                    <User size={18} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex gap-4 justify-start items-center">
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-sm text-indigo-400 shrink-0">
                <Bot size={18} />
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 rounded-tl-none text-slate-400 text-sm flex items-center space-x-2 shadow-sm animate-pulse">
                <span>Portia is thinking</span>
                <span className="flex space-x-1">
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Running State status text indicator bar */}
      <div className="w-full max-w-3xl mx-auto px-6 py-1 text-xs text-slate-500 flex justify-between items-center shrink-0">
        <span className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isLoading ? "bg-indigo-500 animate-spin" : "bg-emerald-500"}`}></span>
          {statusText}
        </span>
        <span className="font-mono text-[11px] text-indigo-400/80 font-semibold">{audioStatus}</span>
      </div>

      {/* Lower Entry Input Action bar */}
      <footer className="p-6 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            
            {/* Round Mic Control Button */}
            <button
              type="button"
              onClick={handleMicToggle}
              className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0 shadow-md ${
                isListening 
                  ? "bg-red-600 text-white animate-pulse hover:bg-red-500" 
                  : "bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
              }`}
              title="Voice Input"
            >
              {isListening ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Input Bar Field */}
            <div className="flex-1 relative flex items-center bg-slate-950 border border-slate-800 rounded-xl focus-within:border-indigo-500/80 transition-all duration-200 shadow-inner">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                disabled={isLoading}
                placeholder={isListening ? "Listening... speak clearly" : "Type a message or speak..."}
                className="w-full bg-transparent px-5 py-4 focus:outline-none text-slate-100 placeholder-slate-500 text-sm md:text-base disabled:text-slate-500"
              />
              
              <button
                type="submit"
                disabled={isLoading || userInput.trim() === ""}
                className={`mr-3 p-2.5 rounded-lg transition-all duration-200 focus:outline-none ${
                  userInput.trim() !== "" && !isLoading
                    ? "bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
                    : "bg-slate-850 text-slate-600 pointer-events-none"
                }`}
              >
                <Send size={18} />
              </button>
            </div>

          </form>
        </div>
      </footer>

    </div>
  );
}

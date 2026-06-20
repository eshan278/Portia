import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser limit and types
  app.use(express.json());

  // API Route for conversation
  app.post("/chat", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ 
        error: "Missing GEMINI_API_KEY. Please verify you have configured secrets or a local key." 
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const { message, history } = req.body;

      // Construct messages in standard GenAI SDK format
      const contents = (history || []).map((it: any) => ({
        role: it.role,
        parts: (it.parts || []).map((part: any) => ({ text: part.text })),
      }));

      // Add the user's current message
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction: "You are Portia, a helpful and friendly personal voice AI assistant. Keep responses sweet, concise, and dynamic, as they will be read aloud."
        }
      });

      const reply = response.text || "I was unable to formulate a response.";
      res.json({ reply });

    } catch (err: any) {
      console.error("Gemini Server Error:", err);
      res.status(500).json({ error: err.message || "An error occurred inside the Gemini API engine." });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Portia Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((e) => {
  console.error("Failed to start Portia server:", e);
});

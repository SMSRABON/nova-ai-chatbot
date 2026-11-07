import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const personalities = {
  helpful: "You are Nova, a helpful, accurate, friendly AI assistant. Explain clearly and adapt to the user's level.",
  tutor: "You are Nova Tutor, a patient teacher. Explain concepts step by step, use simple examples, and encourage learning.",
  coder: "You are Nova Code, an expert programming assistant. Give correct, secure, maintainable code and explain important parts.",
  writer: "You are Nova Writer, a creative and professional writing assistant. Produce polished writing in the requested tone."
};

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(ai), model: MODEL });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is missing. Add GEMINI_API_KEY to your .env file and restart the server."
      });
    }

    const { messages, personality = "helpful" } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Please send a message." });
    }
    if (messages.length > 30) {
      return res.status(400).json({ error: "This conversation is too long. Start a new chat." });
    }

    const contents = messages.map((item) => {
      const role = item?.role === "assistant" ? "model" : "user";
      const text = typeof item?.content === "string" ? item.content.trim() : "";
      if (!text || text.length > 12000) {
        throw new Error("Each message must contain 1–12,000 characters.");
      }
      return { role, parts: [{ text }] };
    });

    if (contents[contents.length - 1].role !== "user") {
      return res.status(400).json({ error: "The last message must be from the user." });
    }

    const systemInstruction = personalities[personality] || personalities.helpful;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    const answer = response.text?.trim();
    if (!answer) {
      return res.status(502).json({ error: "The AI did not return text. Please try again." });
    }

    res.json({ reply: answer });
  } catch (error) {
    console.error("Chat API error:", error);
    const message = error?.message || "Something went wrong while contacting Gemini.";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Nova AI is running at http://localhost:${PORT}`);
  if (!apiKey) console.warn("GEMINI_API_KEY is not configured. Add it to .env.");
});

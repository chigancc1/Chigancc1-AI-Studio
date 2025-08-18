import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { name } = req.query || {};
    if (!name) return res.status(400).json({ error: "Missing operation name" });

    const ai = new GoogleGenAI({ apiKey });
    // Poll by name
    const op = await ai.operations.getVideosOperation({ name });

    if (!op.done) return res.status(200).json({ done: false });

    const fileRef = op.response?.generatedVideos?.[0]?.video;
    if (!fileRef) return res.status(500).json({ done: true, error: "No video in response" });

    res.status(200).json({ done: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}

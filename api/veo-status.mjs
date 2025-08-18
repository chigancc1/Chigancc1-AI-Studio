// /api/veo-status.mjs
export const config = { runtime: "nodejs20.x" };

import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { name } = req.query;
    if (!name) return res.status(400).json({ error: "Missing operation name" });

    const ai = new GoogleGenAI({ apiKey });

    // Re-create a minimal operation object from name
    const op = await ai.operations.getVideosOperation({ operation: { name } });

    if (!op.done) return res.status(200).json({ done: false });

    const fileRef = op.response?.generatedVideos?.[0]?.video;
    if (!fileRef) return res.status(500).json({ error: "No video in response", done: true });

    res.status(200).json({ done: true, fileId: fileRef.file?.name || fileRef.name || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}

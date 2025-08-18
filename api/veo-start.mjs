// /api/veo-start.mjs
export const config = { runtime: "nodejs20.x" };

import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { prompt, aspectRatio, durationSec, fps, resolution, negativePrompt, imageBase64, imageMime } =
      req.body || {};

    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    if (!imageBase64 || !imageMime) return res.status(400).json({ error: "Missing image" });

    const ai = new GoogleGenAI({ apiKey });

    // Map UI choices into the request. Veo 2 accepts aspectRatio directly;
    // other knobs are steered via prompt notes for maximum compatibility.
    const fullPrompt = [
      prompt,
      negativePrompt ? `\nNEGATIVE: ${negativePrompt}` : "",
      durationSec ? `\nTarget duration: ${durationSec}s` : "",
      fps ? `\nTarget frame rate: ${fps} fps` : "",
      resolution ? `\nTarget resolution: ${resolution}` : "",
    ].join("");

    // Kick off a long-running operation (DO NOT wait here).
    const op = await ai.models.generateVideos({
      model: "veo-2.0-generate-001",
      prompt: fullPrompt,
      image: { imageBytes: imageBase64, mimeType: imageMime },
      config: { aspectRatio: aspectRatio || "9:16" },
    });

    // Return the opaque operation identifier
    res.status(200).json({ operation: op });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}

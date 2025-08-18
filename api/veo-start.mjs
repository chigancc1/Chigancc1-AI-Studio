import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { prompt, aspectRatio, durationSec, fps, resolution, negativePrompt, imageBase64, imageMime } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    if (!imageBase64 || !imageMime) return res.status(400).json({ error: "Missing image" });

    const ai = new GoogleGenAI({ apiKey });

    const fullPrompt = [
      prompt,
      negativePrompt ? `\nNEGATIVE: ${negativePrompt}` : "",
      durationSec ? `\nTarget duration: ${durationSec}s` : "",
      fps ? `\nTarget frame rate: ${fps} fps` : "",
      resolution ? `\nTarget resolution: ${resolution}` : ""
    ].join("");

    const op = await ai.models.generateVideos({
      model: "veo-2.0-generate-001",
      prompt: fullPrompt,
      image: { imageBytes: imageBase64, mimeType: imageMime },
      config: { aspectRatio: aspectRatio || "9:16" }
    });

    // Return only the operation name (works with getVideosOperation)
    const name = op?.name || op?.operation?.name || op?.metadata?.name;
    if (!name) return res.status(500).json({ error: "Missing operation name from API" });

    res.status(200).json({ name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}

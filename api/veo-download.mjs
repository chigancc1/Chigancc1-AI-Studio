// /api/veo-download.mjs
export const config = { runtime: "nodejs" };

import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { name } = req.query; // operation name
    if (!name) return res.status(400).json({ error: "Missing operation name" });

    const ai = new GoogleGenAI({ apiKey });

    // Verify it's done and get the file ref
    const op = await ai.operations.getVideosOperation({ operation: { name } });
    if (!op.done) return res.status(202).json({ error: "Not ready" });

    const fileRef = op.response?.generatedVideos?.[0]?.video;
    if (!fileRef) return res.status(500).json({ error: "No video in response" });

    // Download bytes and proxy to client
    const tmpPath = "/tmp/output.mp4";
    await ai.files.download({ file: fileRef, downloadPath: tmpPath });

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'inline; filename="veo-output.mp4"');

    const fs = await import("fs");
    fs.createReadStream(tmpPath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}

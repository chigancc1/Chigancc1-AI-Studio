import { GoogleGenAI } from "@google/genai";
import fs from "fs";

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { name } = req.query || {};
    if (!name) return res.status(400).json({ error: "Missing operation name" });

    const ai = new GoogleGenAI({ apiKey });
    const op = await ai.operations.getVideosOperation({ name });
    if (!op.done) return res.status(202).json({ error: "Not ready" });

    const fileRef = op.response?.generatedVideos?.[0]?.video;
    if (!fileRef) return res.status(500).json({ error: "No video in response" });

    const tmp = "/tmp/veo-output.mp4";
    await ai.files.download({ file: fileRef, downloadPath: tmp });

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'inline; filename="veo-output.mp4"');
    fs.createReadStream(tmp).pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}

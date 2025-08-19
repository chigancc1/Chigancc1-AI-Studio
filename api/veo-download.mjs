import { GoogleGenAI } from "@google/genai";
import fs from "fs";

async function getOperation(ai, apiKey, name) {
  if (ai?.operations) {
    if (typeof ai.operations.getVideosOperation === "function") {
      try { return await ai.operations.getVideosOperation({ name }); } catch {}
      try { return await ai.operations.getVideosOperation({ operation: { name } }); } catch {}
    }
    if (typeof ai.operations.getOperation === "function") {
      try { return await ai.operations.getOperation({ name }); } catch {}
    }
  }
  const base = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(name.startsWith("operations/") ? name : `operations/${name}`)}`;
  const url = `${base}?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`REST get operation failed: ${r.status} ${await r.text().catch(()=>r.status)}`);
  return await r.json();
}

function extractFileRef(op) {
  const resp = op?.response || {};
  return (
    resp?.generatedVideos?.[0]?.video ||
    resp?.videos?.[0]?.video ||
    resp?.video ||
    resp?.generatedVideo ||
    null
  );
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { name } = req.query || {};
    if (!name) return res.status(400).json({ error: "Missing operation name" });

    const ai = new GoogleGenAI({ apiKey });
    const op = await getOperation(ai, apiKey, name);

    if (!op?.done) return res.status(202).json({ error: "Not ready" });

    const fileRef = extractFileRef(op);
    if (!fileRef) {
      const reason =
        op?.error?.message ||
        op?.response?.error?.message ||
        op?.response?.blockReason ||
        op?.response?.state ||
        "No video in response";
      return res.status(422).json({ error: reason });
    }

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

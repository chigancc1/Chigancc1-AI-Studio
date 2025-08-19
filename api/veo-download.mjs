import { GoogleGenAI } from "@google/genai";
import fs from "fs";

/** Same helper as in status */
async function getOperationByName(ai, apiKey, name) {
  if (ai?.operations) {
    if (typeof ai.operations.getVideosOperation === "function") {
      try { return await ai.operations.getVideosOperation({ name }); } catch (_) {}
      try { return await ai.operations.getVideosOperation({ operation: { name } }); } catch (_) {}
    }
    if (typeof ai.operations.getOperation === "function") {
      try { return await ai.operations.getOperation({ name }); } catch (_) {}
    }
  }

  const tryRest = async (opName) => {
    const base = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(opName)}`;
    const url = `${base}?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    if (!r.ok) {
      const t = await r.text().catch(() => String(r.status));
      throw new Error(`REST get operation failed: ${r.status} ${t}`);
    }
    return await r.json();
  };

  try { return await tryRest(name); } catch (e1) {
    if (!String(name).startsWith("operations/") && !String(name).includes("/operations/")) {
      const alt = `operations/${name}`;
      return await tryRest(alt);
    }
    throw e1;
  }
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });

    const { name } = req.query || {};
    if (!name) return res.status(400).json({ error: "Missing operation name" });

    const ai = new GoogleGenAI({ apiKey });
    const op = await getOperationByName(ai, apiKey, name);

    if (!op?.done) return res.status(202).json({ error: "Not ready" });

    const fileRef = op?.response?.generatedVideos?.[0]?.video;
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

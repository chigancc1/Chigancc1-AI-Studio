import { GoogleGenAI } from "@google/genai";

/** Robustly fetch an operation by name, across SDK versions. */
async function getOperationByName(ai, apiKey, name) {
  // 1) Try SDK variants first
  if (ai?.operations) {
    if (typeof ai.operations.getVideosOperation === "function") {
      try { return await ai.operations.getVideosOperation({ name }); } catch (_) {}
      try { return await ai.operations.getVideosOperation({ operation: { name } }); } catch (_) {}
    }
    if (typeof ai.operations.getOperation === "function") {
      try { return await ai.operations.getOperation({ name }); } catch (_) {}
    }
  }

  // 2) REST fallback (correct path encoding)
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

  // Try as-is
  try { return await tryRest(name); } catch (e1) {
    // If the name was bare (no prefix), try with operations/
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

    const done = !!op?.done;
    if (!done) return res.status(200).json({ done: false });

    const fileRef = op?.response?.generatedVideos?.[0]?.video;
    if (!fileRef) return res.status(500).json({ done: true, error: "No video in response" });

    res.status(200).json({ done: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}

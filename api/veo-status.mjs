import { GoogleGenAI } from "@google/genai";

/** Try SDK first; fall back to REST without breaking slashes in name */
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
  const fetchRest = async (opName) => {
    const base = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(opName)}`;
    const url = `${base}?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`REST get operation failed: ${r.status} ${await r.text().catch(()=>r.status)}`);
    return await r.json();
  };
  try { return await fetchRest(name); }
  catch (e) {
    if (!String(name).startsWith("operations/")) return await fetchRest(`operations/${name}`);
    throw e;
  }
}

function extractFileRef(op) {
  // Try the common shapes
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

    if (!op?.done) return res.status(200).json({ done: false });

    const fileRef = extractFileRef(op);

    // Build a helpful reason if no video
    let reason = null;
    if (!fileRef) {
      reason =
        op?.error?.message ||
        op?.response?.error?.message ||
        op?.response?.blockReason ||
        op?.response?.state ||
        "API returned no video object";
    }

    // Tell the client what to do next
    return res.status(200).json({
      done: true,
      hasVideo: !!fileRef,
      reason
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}

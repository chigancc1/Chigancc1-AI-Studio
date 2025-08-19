import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { Readable } from "stream";

/** Re-fetch operation to obtain the file ref */
async function getOperation(ai, apiKey, name) {
  // Try SDK first
  if (ai?.operations) {
    if (typeof ai.operations.getVideosOperation === "function") {
      try { return await ai.operations.getVideosOperation({ name }); } catch {}
      try { return await ai.operations.getVideosOperation({ operation: { name } }); } catch {}
    }
    if (typeof ai.operations.getOperation === "function") {
      try { return await ai.operations.getOperation({ name }); } catch {}
    }
  }
  // REST fallback (keep slashes in name)
  const base = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(
    name.startsWith("operations/") ? name : `operations/${name}`
  )}`;
  const url = `${base}?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`REST get operation failed: ${r.status} ${await r.text().catch(()=>r.status)}`);
  return await r.json();
}

function extractFileRef(op) {
  const resp = op?.response || {};
  return (
    resp?.generatedVideos?.[0]?.video || // common shape
    resp?.videos?.[0]?.video ||
    resp?.video ||
    resp?.generatedVideo ||
    null
  );
}

async function streamFetchToRes(r, res) {
  if (!r.ok) {
    const txt = await r.text().catch(()=> "");
    res.statusCode = r.status || 500;
    res.end(txt || "Upstream download failed");
    return;
  }
  // Try to preserve content type if provided
  const ct = r.headers.get("content-type") || "video/mp4";
  res.setHeader("Content-Type", ct);
  res.setHeader("Content-Disposition", 'inline; filename="veo-output.mp4"');

  if (r.body && typeof r.body.getReader === "function") {
    // Stream WebReadable → Node response
    Readable.fromWeb(r.body).pipe(res);
  } else {
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  }
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).send("Server missing GEMINI_API_KEY");

    const { name } = req.query || {};
    if (!name) return res.status(400).send("Missing operation name");

    const ai = new GoogleGenAI({ apiKey });
    const op = await getOperation(ai, apiKey, name);

    if (!op?.done) return res.status(202).send("Not ready");

    const fileRef = extractFileRef(op);
    if (!fileRef) {
      const reason =
        op?.error?.message ||
        op?.response?.error?.message ||
        op?.response?.blockReason ||
        op?.response?.state ||
        "No video in response";
      return res.status(422).send(reason);
    }

    // 1) Try SDK download to /tmp
    try {
      const tmp = "/tmp/veo-output.mp4";
      await ai.files.download({ file: fileRef, downloadPath: tmp }); // supports {name}/or {uri}
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", 'inline; filename="veo-output.mp4"');
      fs.createReadStream(tmp).pipe(res);
      return;
    } catch (e) {
      // continue to fallbacks
    }

    // 2) If we have a signed uri, stream it directly
    if (fileRef?.uri) {
      // Try as-is
      let r = await fetch(fileRef.uri);
      if (!r.ok) {
        // If it wasn't signed with key in URL, try appending key
        const sep = fileRef.uri.includes("?") ? "&" : "?";
        r = await fetch(`${fileRef.uri}${sep}key=${encodeURIComponent(apiKey)}`);
      }
      return await streamFetchToRes(r, res);
    }

    // 3) If we have a file name, call REST :download (usually redirects to bytes)
    const fileName = fileRef?.name || fileRef; // sometimes the ref is just the name string
    if (fileName) {
      const base = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(fileName)}`;
      const url = `${base}:download?key=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url, { redirect: "follow" }); // follow to signed media URL
      return await streamFetchToRes(r, res);
    }

    // If we get here, we didn't recognize the shape
    return res.status(500).send("Unable to locate downloadable video reference");
  } catch (e) {
    console.error(e);
    res.status(500).send(e?.message || "Unknown error");
  }
}

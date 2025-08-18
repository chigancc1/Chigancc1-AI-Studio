// veo-i2v.mjs
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Use a CLI arg or default to ./input.png
const argPath = process.argv[2] || "./input.png";
const imagePath = path.resolve(argPath);

// Basic checks
if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
  console.error(`❌ Image file not found: ${imagePath}`);
  process.exit(1);
}

// Convert the file to Base64 (string)
const mimeType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
const imageBase64 = fs.readFileSync(imagePath).toString("base64");

const prompt =
  "Subtle forward motion toward camera; gentle handheld; slight parallax; preserve subject; vertical 9:16.";

let op = await ai.models.generateVideos({
  model: "veo-2.0-generate-001",
  prompt,
  image: { imageBytes: imageBase64, mimeType }, // <-- Base64 string now
  config: { aspectRatio: "9:16" },
});

// Poll until done
while (!op.done) {
  console.log("Waiting for video generation…");
  await new Promise((r) => setTimeout(r, 10_000));
  op = await ai.operations.getVideosOperation({ operation: op });
}

const fileRef = op.response?.generatedVideos?.[0]?.video;
if (!fileRef) {
  console.error("❌ No video returned. Full response:\n", JSON.stringify(op, null, 2));
  process.exit(1);
}

await ai.files.download({ file: fileRef, downloadPath: "output.mp4" });
console.log("✅ Saved to output.mp4");

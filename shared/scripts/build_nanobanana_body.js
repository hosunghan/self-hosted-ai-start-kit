// /data/shared/scripts/build_nanobanana_body.js
// Usage: node build_nanobanana_body.js <payload_b64>
//
// Reads base64-encoded JSON payload from argv[2],
// loads up to 5 fixed character images (required) and optional background image,
// builds Gemini generateContent body JSON, writes it to /tmp,
// and prints a SMALL JSON { bodyFile, ...meta } to stdout.
//
// NOTE: This script intentionally avoids printing base64 blobs to stdout.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function extToMime(p) {
  const ext = (path.extname(p) || '').toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/webp';
}

function safeJoin(root, rel) {
  const cleaned = String(rel || '').replace(/^\/+/, '');
  return path.join(root, cleaned);
}

function readB64IfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath).toString('base64');
}

const payloadB64 = process.argv[2];
if (!payloadB64) {
  console.error('Missing payload_b64 argument');
  process.exit(1);
}

let input;
try {
  input = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
} catch (e) {
  console.error('Failed to decode/parse payload_b64');
  process.exit(1);
}

const assetsDir = input.assetsDir || '/data/shared';
const pickedCut = input.pickedCut || {};
const characterRefMap = input.character_ref_map || {};
const geminiModel = input.geminiModel || 'gemini-2.0-flash';

const parts = [];

// Optional background
if (pickedCut.background_ref) {
  const bgPath = safeJoin(assetsDir, pickedCut.background_ref);
  const bgB64 = readB64IfExists(bgPath);
  if (bgB64) {
    parts.push({ text: 'BACKGROUND (use as base scene, no text)' });
    parts.push({ inlineData: { mimeType: extToMime(bgPath), data: bgB64 } });
  }
}

// Required 5 characters
const charKeys = ['han_soyeon', 'choi_daeun', 'kim_hajun', 'park_hyewon', 'seo_junho'];
for (let i = 0; i < charKeys.length; i++) {
  const k = charKeys[i];
  const ref = characterRefMap[k];
  if (!ref) {
    throw new Error(`character_ref_map missing key: ${k}`);
  }
  const p = safeJoin(assetsDir, ref);
  const b64 = readB64IfExists(p);
  if (!b64) {
    throw new Error(`Character image not found: ${p}`);
  }
  parts.push({ text: `CHARACTER_${i + 1}: ${k} (keep identity consistent)` });
  parts.push({ inlineData: { mimeType: extToMime(p), data: b64 } });
}

// Instruction text (no emotion words)
const instruction = [
  'WEBTOON animation style, clean lineart, soft cel shading, vertical webtoon framing',
  'No text, no watermark, no logo',
  'Full body (head to toe) for any visible character',
  pickedCut.nanobanana_prompt_en || input.prompt || ''
].filter(Boolean).join('. ');

parts.push({ text: instruction });

const body = { contents: [{ role: 'user', parts }] };

// Write body to /tmp to avoid stdout maxBuffer
const id = crypto.randomUUID();
const bodyFile = `/tmp/nanobanana_body_${id}.json`;
fs.writeFileSync(bodyFile, JSON.stringify(body), 'utf8');

// Return SMALL JSON
process.stdout.write(JSON.stringify({
  ...input,
  geminiModel,
  bodyFile,
}));
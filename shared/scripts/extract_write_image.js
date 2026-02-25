// /data/shared/scripts/extract_write_image.js
// Usage: node extract_write_image.js <payload_b64>
//
// Expects payload JSON (base64) that includes:
// - respFile
// - finalImagePath
// Creates directory if needed, extracts inlineData base64, writes PNG.

const fs = require('fs');
const path = require('path');

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

const respFile = input.respFile;
if (!respFile) throw new Error('respFile missing');
if (!fs.existsSync(respFile)) throw new Error(`respFile not found: ${respFile}`);

let resp;
try {
  resp = JSON.parse(fs.readFileSync(respFile, 'utf8'));
} catch (e) {
  throw new Error('Failed to parse Gemini response JSON from respFile');
}

const parts = resp?.candidates?.[0]?.content?.parts ?? [];

let inline = null;
for (const p of parts) {
  if (p?.inlineData?.data) { inline = p.inlineData; break; }
  if (p?.inline_data?.data) { inline = p.inline_data; break; }
}
if (!inline?.data || typeof inline.data !== 'string') {
  throw new Error('No inline image data found in Gemini response');
}

const b64 = inline.data.replace(/^data:.*;base64,/, '');
const buf = Buffer.from(b64, 'base64');

let outPath = input.finalImagePath;
if (!outPath) throw new Error('finalImagePath missing');
outPath = outPath.replace(/\.(webp|jpg|jpeg|png)$/i, '.png');

const outDir = path.dirname(outPath);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, buf);

process.stdout.write(JSON.stringify({
  ...input,
  finalImagePath: outPath,
  finalImageDir: outDir,
  writtenBytes: buf.length,
}));
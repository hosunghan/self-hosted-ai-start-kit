// /data/shared/scripts/call_gemini_generate.js
// Usage: node call_gemini_generate.js <payload_b64>
//
// Expects payload JSON (base64) that includes:
// - geminiModel
// - bodyFile (path to JSON request body)
// - finalImagePath / finalImageDir (for downstream)
// Uses env GEMINI_API_KEY.
// Writes response JSON to /tmp and prints SMALL JSON { respFile, ...meta }.

const fs = require('fs');
const crypto = require('crypto');

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

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing env GEMINI_API_KEY');
  process.exit(1);
}

const model = input.geminiModel || 'gemini-2.5-flash-image';
const bodyFile = input.bodyFile;
if (!bodyFile) {
  console.error('bodyFile missing');
  process.exit(1);
}
if (!fs.existsSync(bodyFile)) {
  console.error(`bodyFile not found: ${bodyFile}`);
  process.exit(1);
}

// ✅ 원래대로: bodyFile 내용을 "그대로" 보냄 (주입/삭제/파싱 없음)
const body = fs.readFileSync(bodyFile, 'utf8');

async function main() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const txt = await res.text(); // may be large
  const id = crypto.randomUUID();
  const respFile = `/tmp/gemini_resp_${id}.json`;
  fs.writeFileSync(respFile, txt, 'utf8');

  process.stdout.write(JSON.stringify({
    ...input,
    respFile,
    httpStatus: res.status,
  }));
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
const fs = require("fs");
const path = require("path");

function mustStr(v, name) {
  if (typeof v !== "string" || !v.trim()) throw new Error(name + " missing");
  return v.trim();
}
function mustArr5(v, name) {
  if (!Array.isArray(v) || v.length !== 5) throw new Error(name + " must have 5 items");
  v.forEach((x,i)=>{ if (typeof x !== "string" || !x.trim()) throw new Error(`${name}[${i}] missing`); });
  return v.map(s => s.trim());
}

const stdin = fs.readFileSync(0, "utf8").trim();
if (!stdin) throw new Error("stdin empty (n8n Execute Command -> Stdin must be JSON)");

let input;
try { input = JSON.parse(stdin); }
catch (e) { throw new Error("Failed to parse stdin JSON: " + e.message + "\nHEAD=" + stdin.slice(0, 200)); }

const outBody = mustStr(input.composeBodyFile, "composeBodyFile");
const prompt  = mustStr(input.composePromptEn, "composePromptEn");
const bgPath  = mustStr(input.coverBgPath, "coverBgPath");
const chars   = mustArr5(input.coverCharPaths, "coverCharPaths");

function inlineDataFromFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" :
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" :
    ext === ".webp" ? "image/webp" :
    "application/octet-stream";
  return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
}

if (!fs.existsSync(bgPath)) throw new Error("Background not found: " + bgPath);
chars.forEach((p,i)=>{ if (!fs.existsSync(p)) throw new Error(`Character ${i+1} not found: ${p}`); });

const parts = [
  { text: "BACKGROUND" }, inlineDataFromFile(bgPath),
  { text: "CHAR_1" }, inlineDataFromFile(chars[0]),
  { text: "CHAR_2" }, inlineDataFromFile(chars[1]),
  { text: "CHAR_3" }, inlineDataFromFile(chars[2]),
  { text: "CHAR_4" }, inlineDataFromFile(chars[3]),
  { text: "CHAR_5" }, inlineDataFromFile(chars[4]),
  { text: prompt },
];

const body = {
  contents: [{ role: "user", parts }],
  generationConfig: { imageConfig: { aspectRatio: "3:4" } },
};

fs.mkdirSync(path.dirname(outBody), { recursive: true });
fs.writeFileSync(outBody, JSON.stringify(body, null, 2), "utf8");

console.log(JSON.stringify({
  composeBodyFile: outBody,
  partsCount: parts.length,
  composeBodyBytes: fs.statSync(outBody).size
}));

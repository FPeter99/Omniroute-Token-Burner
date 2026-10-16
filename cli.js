import { BurnEngine } from './burn-engine.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Hitelesítés automatikus detektálása
function getDetectedAuth() {
  let apiKey = process.env.OMNIROUTE_API_KEY || '';
  const baseURL = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';

  if (!apiKey) {
    try {
      const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
      if (fs.existsSync(authPath)) {
        const raw = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        apiKey = raw['opencode-omniroute']?.key || raw['omniroute']?.key || '';
      }
    } catch {}
  }
  return { apiKey, baseURL };
}

const auth = getDetectedAuth();

// CLI kapcsolók feldolgozása
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return def;
}

const model = getArg('model', 'agy/gemini-3.8-flash-high');
const concurrency = parseInt(getArg('concurrency', '8'), 10);
const mode = getArg('mode', 'infinite'); // 'infinite' | 'target' | 'duration'
const targetTokens = parseInt(getArg('target', '1000000'), 10);
const durationMinutes = parseFloat(getArg('duration', '30'));
const batchSize = getArg('size', 'monster'); // 'monster' | 'large' | 'normal'
const apiKey = getArg('key', auth.apiKey);
const baseURL = getArg('url', auth.baseURL);

console.clear();
console.log(`\x1b[38;5;208m`);
console.log(`  ██████╗ ███╗   ███╗███╗   ██╗██╗██████╗  ██████╗ ██╗   ██╗████████╗███████╗`);
console.log(` ██╔═══██╗████╗ ████║████╗  ██║██║██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██╔════╝`);
console.log(` ██║   ██║██╔████╔██║██╔██╗ ██║██║██████╔╝██║   ██║██║   ██║   ██║   █████╗  `);
console.log(` ██║   ██║██║╚██╔╝██║██║╚██╗██║██║██╔══██╗██║   ██║██║   ██║   ██║   ██╔══╝  `);
console.log(` ╚██████╔╝██║ ╚═╝ ██║██║ ╚████║██║██║  ██║╚██████╔╝╚██████╔╝   ██║   ███████╗`);
console.log(`  ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝`);
console.log(`                 🔥 T O K E N   É G E T Ő   C L I 🔥\x1b[0m\n`);

console.log(`\x1b[90m---------------------------------------------------------------\x1b[0m`);
console.log(`  OmniRoute Cím:    \x1b[36m${baseURL}\x1b[0m`);
console.log(`  API Kulcs:        \x1b[33m${apiKey ? '****' + apiKey.slice(-6) : 'NINCS MEGADVA'}\x1b[0m`);
console.log(`  Modell / Stack:   \x1b[32m${model}\x1b[0m`);
console.log(`  Párhuzamos szál:  \x1b[35m${concurrency} szál\x1b[0m`);
console.log(`  Csomag Méret:     \x1b[31m${batchSize.toUpperCase()}\x1b[0m`);

let modeDesc = mode.toUpperCase();
if (mode === 'target') modeDesc += ` (Cél: ${targetTokens.toLocaleString('hu-HU')} token)`;
if (mode === 'duration') modeDesc += ` (Időtartam: ${durationMinutes} perc)`;
console.log(`  Égetési Mód:      \x1b[34m${modeDesc}\x1b[0m`);
console.log(`\x1b[90m---------------------------------------------------------------\x1b[0m\n`);
console.log(`\x1b[93mNyomj [Ctrl+C]-t a biztonságos leállításhoz.\x1b[0m\n`);

const engine = new BurnEngine({
  baseURL,
  apiKey,
  model,
  batchSize,
  concurrency,
  mode,
  targetTokens,
  durationMinutes
});

function formatNum(n) {
  return (n || 0).toLocaleString('hu-HU');
}

function formatTime(s) {
  if (!s || s <= 0) return '00:00:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

// Élő állapotsor frissítése
let lastLineLength = 0;
engine.on('stats', (stats) => {
  const total = formatNum(stats.totalTokensBurned);
  const speed = formatNum(stats.tokensPerSecond);
  const reqs = `${stats.successfulRequests} sikeres / ${stats.failedRequests} hiba`;
  const time = formatTime(stats.elapsedSeconds);

  let extra = '';
  if (stats.mode === 'target') {
    extra = ` | Cél: ${stats.percentComplete}% (még: ~${formatTime(stats.remainingSeconds)})`;
  } else if (stats.mode === 'duration') {
    extra = ` | Hátralévő idő: ~${formatTime(stats.remainingSeconds)}`;
  }

  const line = `🔥 Elégetve: \x1b[1;37m${total}\x1b[0m tok | Sebesség: \x1b[1;33m${speed}\x1b[0m tok/s | Szálak: \x1b[36m${stats.activeWorkers}/${stats.concurrency}\x1b[0m | Kérések: ${reqs} | Idő: ${time}${extra}`;

  process.stdout.write(`\r${line.padEnd(lastLineLength, ' ')}`);
  lastLineLength = line.length;
});

engine.on('request_failed', (log) => {
  process.stdout.write(`\n\x1b[31m[HIBA #${log.workerId + 1}] ${log.message}\x1b[0m\n`);
});

engine.on('stopped', (info) => {
  process.stdout.write(`\n\n\x1b[32m✔ Égetés befejezve (${info.reason}). Összesen elégetve: ${formatNum(info.totalTokensBurned)} token.\x1b[0m\n`);
  process.exit(0);
});

async function handleShutdown() {
  process.stdout.write(`\n\n\x1b[33m🛑 Leállítás...\x1b[0m\n`);
  await engine.stop('felhasznaloi_ctrl_c');
  process.exit(0);
}

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

await engine.start();

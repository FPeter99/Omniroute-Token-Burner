import readline from 'node:readline';
import { BurnEngine } from './burn-engine.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Auto-detect auth
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
  if (!apiKey) apiKey = '';
  return { apiKey, baseURL };
}

const auth = getDetectedAuth();

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(name, def) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return def;
}

const model = getArg('model', 'fp99/spam');
const concurrency = parseInt(getArg('concurrency', '8'), 10);
const mode = getArg('mode', 'infinite'); // 'infinite' | 'target' | 'duration'
const targetTokens = parseInt(getArg('target', '1000000'), 10);
const durationHours = parseFloat(getArg('duration', '6'));
const strategy = getArg('strategy', 'prompt_heavy');
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
console.log(`                 🔥 T O K E N   B U R N E R   C L I 🔥\x1b[0m\n`);

console.log(`\x1b[90m---------------------------------------------------------------\x1b[0m`);
console.log(`  OmniRoute URL:    \x1b[36m${baseURL}\x1b[0m`);
console.log(`  API Key:          \x1b[33m${apiKey ? apiKey.slice(0, 14) + '...' : '(none)'}\x1b[0m`);
console.log(`  Stack / Model:    \x1b[32m${model}\x1b[0m`);
console.log(`  Concurrency:      \x1b[35m${concurrency} threads\x1b[0m`);
console.log(`  Burn Strategy:    \x1b[31m${strategy}\x1b[0m`);
console.log(`  Mode:             \x1b[34m${mode.toUpperCase()}${mode === 'target' ? ` (Target: ${targetTokens.toLocaleString()} tokens)` : mode === 'duration' ? ` (${durationHours} hours)` : ''}\x1b[0m`);
console.log(`\x1b[90m---------------------------------------------------------------\x1b[0m\n`);
console.log(`\x1b[93mNyomj [Ctrl+C]-t a leállításhoz.\x1b[0m\n`);

const engine = new BurnEngine({
  baseURL,
  apiKey,
  model,
  concurrency,
  mode,
  targetTokens,
  durationHours,
  burnStrategy: strategy,
  cacheBuster: true,
  maxTokens: 4096
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

// Live status line renderer
let lastLineLength = 0;
engine.on('stats', (stats) => {
  const total = formatNum(stats.totalTokensBurned);
  const speed = formatNum(stats.tokensPerSecond);
  const reqs = `${stats.successfulRequests} ok / ${stats.failedRequests} err`;
  const time = formatTime(stats.elapsedSeconds);

  let extra = '';
  if (stats.mode === 'target') {
    extra = ` | Cél: ${stats.percentComplete}% (még: ~${formatTime(stats.remainingSeconds)})`;
  } else if (stats.mode === 'duration') {
    extra = ` | Idő: ${stats.percentComplete}% (hátra: ~${formatTime(stats.remainingSeconds)})`;
  }

  const line = `🔥 \x1b[1;31m${total} TOKENS\x1b[0m [⚡ \x1b[36m${speed} tok/s\x1b[0m] | 🚀 \x1b[32m${stats.activeWorkers}/${stats.concurrency}\x1b[0m | ⏱ \x1b[33m${time}\x1b[0m | ${reqs}${extra}`;
  
  process.stdout.write(`\r${line.padEnd(lastLineLength, ' ')}`);
  lastLineLength = line.length;
});

engine.on('request_failed', (log) => {
  process.stdout.write(`\n\x1b[31m[HIBA] Worker #${log.workerId}: ${log.message}\x1b[0m\n`);
});

engine.on('stopped', (info) => {
  process.stdout.write(`\n\n\x1b[1;32m[STOP] Égetés befejezve: ${info.reason}\x1b[0m\n`);
  console.log(`Összesen elégetett token: \x1b[1;31m${formatNum(info.totalTokensBurned)}\x1b[0m`);
  console.log(`Összes kérés: ${formatNum(info.totalRequests)}`);
  console.log(`Eltelt idő: ${formatTime(info.elapsedSeconds)}\n`);
  process.exit(0);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  process.stdout.write(`\n\n\x1b[33mLeállítás kérése folyamatban...\x1b[0m\n`);
  engine.stop('user_ctrl_c');
});

// Launch!
engine.start();

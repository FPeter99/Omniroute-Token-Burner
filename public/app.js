// State
let isRunning = false;
let currentMode = 'infinite';
let eventSource = null;
let speedHistory = []; // last 60 seconds
let peakSpeed = 0;
let logs = [];

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const statusText = connectionStatus.querySelector('.status-text');
const engineStatusBadge = document.getElementById('engineStatusBadge');
const engineStatusText = document.getElementById('engineStatusText');

const valTotalBurned = document.getElementById('valTotalBurned');
const valPromptTokens = document.getElementById('valPromptTokens');
const valCompletionTokens = document.getElementById('valCompletionTokens');
const valSpeed = document.getElementById('valSpeed');
const valReqSpeed = document.getElementById('valReqSpeed');
const valAvgLatency = document.getElementById('valAvgLatency');
const valWorkers = document.getElementById('valWorkers');
const valSuccessCount = document.getElementById('valSuccessCount');
const valErrorCount = document.getElementById('valErrorCount');
const valElapsed = document.getElementById('valElapsed');
const valModeLabel = document.getElementById('valModeLabel');
const subTimeGoal = document.getElementById('subTimeGoal');

const progressBarContainer = document.getElementById('progressBarContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressLabel = document.getElementById('progressLabel');

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnClearLogs = document.getElementById('btnClearLogs');
const btnRefreshModels = document.getElementById('btnRefreshModels');
const refreshIcon = document.getElementById('refreshIcon');

const modeSelector = document.getElementById('modeSelector');
const targetOptions = document.getElementById('targetOptions');
const durationOptions = document.getElementById('durationOptions');
const targetTokensInput = document.getElementById('targetTokensInput');
const durationHoursInput = document.getElementById('durationHoursInput');

const modelSelect = document.getElementById('modelSelect');
const customModelInput = document.getElementById('customModelInput');
const btnApplyCustomModel = document.getElementById('btnApplyCustomModel');
const allModelsOptGroup = document.getElementById('allModelsOptGroup');

const strategySelect = document.getElementById('strategySelect');
const concurrencySlider = document.getElementById('concurrencySlider');
const concurrencyValue = document.getElementById('concurrencyValue');
const cacheBusterCheck = document.getElementById('cacheBusterCheck');

const apiUrlInput = document.getElementById('apiUrlInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const btnToggleKeyVis = document.getElementById('btnToggleKeyVis');

const logsTableBody = document.getElementById('logsTableBody');
const logCountLabel = document.getElementById('logCountLabel');
const speedChart = document.getElementById('speedChart');
const chartPeakSpeed = document.getElementById('chartPeakSpeed');

// Format numbers with thousands separators
function formatNum(n) {
  if (n === null || n === undefined) return '0';
  return n.toLocaleString('hu-HU');
}

// Format seconds into HH:MM:SS
function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// Initialize UI
async function init() {
  setupEventListeners();
  initChart();
  await loadStatus();
  await fetchModels();
  connectSSE();
}

function setupEventListeners() {
  // Mode switcher
  modeSelector.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modeSelector.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      updateModeUI();
    });
  });

  // Presets for target
  document.querySelectorAll('.btn-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      targetTokensInput.value = btn.dataset.val;
    });
  });

  // Presets for duration
  document.querySelectorAll('.btn-preset-time').forEach((btn) => {
    btn.addEventListener('click', () => {
      durationHoursInput.value = btn.dataset.val;
    });
  });

  // Concurrency slider
  concurrencySlider.addEventListener('input', (e) => {
    concurrencyValue.textContent = `${e.target.value} szál`;
    if (isRunning) {
      sendConfigUpdate({ concurrency: parseInt(e.target.value, 10) });
    }
  });

  // Custom model apply
  btnApplyCustomModel.addEventListener('click', () => {
    const custom = customModelInput.value.trim();
    if (!custom) return;
    let existingOpt = Array.from(modelSelect.options).find((o) => o.value === custom);
    if (!existingOpt) {
      existingOpt = document.createElement('option');
      existingOpt.value = custom;
      existingOpt.textContent = `★ ${custom}`;
      modelSelect.appendChild(existingOpt);
    }
    modelSelect.value = custom;
    customModelInput.value = '';
  });

  // Refresh models button
  btnRefreshModels.addEventListener('click', async () => {
    refreshIcon.style.animation = 'flame-flicker 0.6s infinite';
    await fetchModels();
    refreshIcon.style.animation = '';
  });

  // Toggle API key visibility
  btnToggleKeyVis.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    btnToggleKeyVis.textContent = apiKeyInput.type === 'password' ? '👁' : '🙈';
  });

  // Start button
  btnStart.addEventListener('click', startBurn);

  // Stop button
  btnStop.addEventListener('click', stopBurn);

  // Clear logs button
  btnClearLogs.addEventListener('click', () => {
    logs = [];
    renderLogs();
  });
}

function updateModeUI() {
  targetOptions.style.display = currentMode === 'target' ? 'block' : 'none';
  durationOptions.style.display = currentMode === 'duration' ? 'block' : 'none';

  if (currentMode === 'target') {
    valModeLabel.textContent = `Cél: ${formatNum(parseInt(targetTokensInput.value, 10))} tok`;
  } else if (currentMode === 'duration') {
    valModeLabel.textContent = `Időzítő: ${durationHoursInput.value} óra`;
  } else {
    valModeLabel.textContent = 'Folyamatos';
  }
}

// Fetch Initial Status
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return;
    const data = await res.json();
    const defaults = data.detectedDefaults || {};
    const engine = data.engine || {};

    if (defaults.apiKey && !apiKeyInput.value) {
      apiKeyInput.value = defaults.apiKey;
    }
    if (defaults.baseURL && !apiUrlInput.value) {
      apiUrlInput.value = defaults.baseURL;
    }

    if (engine.isRunning) {
      applyEngineRunningState(true);
      applyStatsUpdate(engine);
    }
  } catch (err) {
    console.error('Failed to load status:', err);
  }
}

// Fetch Models from OmniRoute via Backend
async function fetchModels() {
  try {
    const baseURL = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const url = `/api/models?baseURL=${encodeURIComponent(baseURL)}&apiKey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn('Could not fetch models directly from OmniRoute');
      return;
    }
    const data = await res.json();
    const combos = data.combos || [];
    const models = data.models || [];

    // Clear and rebuild modelSelect
    modelSelect.innerHTML = '';

    const comboGroup = document.createElement('optgroup');
    comboGroup.label = '🔥 OmniRoute Stacks & Combos';

    for (const c of combos) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.id} ${c.id === 'fp99/spam' ? '★ (Ajánlott Burner)' : ''}`;
      comboGroup.appendChild(opt);
    }
    modelSelect.appendChild(comboGroup);

    const modelGroup = document.createElement('optgroup');
    modelGroup.label = `⚡ További elérhető modellek (${models.length} db)`;

    // Take top 100 models to keep DOM lightweight
    const sampleModels = models.slice(0, 150);
    for (const m of sampleModels) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id;
      modelGroup.appendChild(opt);
    }
    modelSelect.appendChild(modelGroup);

    // Prefer fp99/spam if present
    if (combos.some((c) => c.id === 'fp99/spam')) {
      modelSelect.value = 'fp99/spam';
    }
  } catch (err) {
    console.warn('Error fetching models:', err);
  }
}

// Connect Server-Sent Events (SSE)
function connectSSE() {
  if (eventSource) {
    eventSource.close();
  }

  eventSource = new EventSource('/api/stream');

  eventSource.onopen = () => {
    connectionStatus.className = 'status-badge online';
    statusText.textContent = 'OmniRoute Online';
  };

  eventSource.onerror = () => {
    connectionStatus.className = 'status-badge offline';
    statusText.textContent = 'Kapcsolat megszakadt';
  };

  eventSource.addEventListener('init', (e) => {
    const stats = JSON.parse(e.data);
    applyStatsUpdate(stats);
    if (stats.isRunning) applyEngineRunningState(true);
  });

  eventSource.addEventListener('stats', (e) => {
    const stats = JSON.parse(e.data);
    applyStatsUpdate(stats);
  });

  eventSource.addEventListener('request_success', (e) => {
    const log = JSON.parse(e.data);
    addLogEntry(log);
  });

  eventSource.addEventListener('request_failed', (e) => {
    const log = JSON.parse(e.data);
    addLogEntry(log);
  });

  eventSource.addEventListener('started', () => {
    applyEngineRunningState(true);
  });

  eventSource.addEventListener('stopped', (e) => {
    const info = JSON.parse(e.data);
    applyEngineRunningState(false);
  });
}

function applyEngineRunningState(running) {
  isRunning = running;
  if (running) {
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-flex';
    engineStatusBadge.className = 'engine-badge burning';
    engineStatusText.textContent = '🔥 ÉGETÉS FOLYAMATBAN';
  } else {
    btnStart.style.display = 'inline-flex';
    btnStop.style.display = 'none';
    engineStatusBadge.className = 'engine-badge';
    engineStatusText.textContent = 'KÉSZENLÉT';
  }
}

function applyStatsUpdate(stats) {
  valTotalBurned.textContent = formatNum(stats.totalTokensBurned || 0);
  valPromptTokens.textContent = formatNum(stats.totalPromptTokens || 0);
  valCompletionTokens.textContent = formatNum(stats.totalCompletionTokens || 0);

  const speed = stats.tokensPerSecond || 0;
  valSpeed.innerHTML = `${formatNum(speed)} <small>tok/mp</small>`;
  valReqSpeed.textContent = stats.requestsPerSecond || 0;

  valWorkers.textContent = `${stats.activeWorkers || 0} / ${stats.concurrency || concurrencySlider.value}`;
  valSuccessCount.textContent = formatNum(stats.successfulRequests || 0);
  valErrorCount.textContent = formatNum(stats.failedRequests || 0);

  valElapsed.textContent = formatTime(stats.elapsedSeconds || 0);

  // Update speed history for chart
  if (stats.isRunning) {
    speedHistory.push(speed);
    if (speedHistory.length > 50) speedHistory.shift();
    if (speed > peakSpeed) {
      peakSpeed = speed;
      chartPeakSpeed.textContent = `Csúcs: ${formatNum(peakSpeed)} tok/s`;
    }
    renderChart();
  }

  // Progress Bar
  if (stats.mode === 'target' || stats.mode === 'duration') {
    progressBarContainer.style.display = 'block';
    const pct = stats.percentComplete || 0;
    progressFill.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;

    if (stats.mode === 'target') {
      const remaining = stats.targetTokens - stats.totalTokensBurned;
      progressLabel.textContent = `Cél: ${formatNum(stats.totalTokensBurned)} / ${formatNum(stats.targetTokens)} token (még ${formatNum(Math.max(0, remaining))})`;
      if (stats.remainingSeconds !== null) {
        subTimeGoal.innerHTML = `<span>Hátralévő idő: <b>~${formatTime(stats.remainingSeconds)}</b></span>`;
      }
    } else {
      progressLabel.textContent = `Időzítő: ${formatTime(stats.elapsedSeconds)} / ${formatTime(stats.durationMs / 1000)}`;
      if (stats.remainingSeconds !== null) {
        subTimeGoal.innerHTML = `<span>Hátralévő: <b>${formatTime(stats.remainingSeconds)}</b></span>`;
      }
    }
  } else {
    progressBarContainer.style.display = 'none';
    subTimeGoal.innerHTML = `<span>Mód: <b>Folyamatos</b></span>`;
  }
}

async function startBurn() {
  const payload = {
    baseURL: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    concurrency: parseInt(concurrencySlider.value, 10),
    mode: currentMode,
    targetTokens: parseInt(targetTokensInput.value, 10) || 1000000,
    durationHours: parseFloat(durationHoursInput.value) || 6,
    burnStrategy: strategySelect.value,
    cacheBuster: cacheBusterCheck.checked,
    maxTokens: strategySelect.value === 'output_heavy' || strategySelect.value === 'extreme' ? 8192 : 4096
  };

  try {
    const res = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(`Hiba az indításkor: ${data.error || 'Ismeretlen hiba'}`);
    }
  } catch (err) {
    alert(`Nem sikerült elérni a szervert: ${err.message}`);
  }
}

async function stopBurn() {
  try {
    await fetch('/api/stop', { method: 'POST' });
  } catch (err) {
    console.error('Failed to stop:', err);
  }
}

async function sendConfigUpdate(config) {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  } catch (err) {
    console.error('Failed to update config:', err);
  }
}

// Logs Management
function addLogEntry(log) {
  logs.unshift(log);
  if (logs.length > 60) logs.pop();
  renderLogs();
}

function renderLogs() {
  logCountLabel.textContent = `${logs.length} naplóbejegyzés`;
  if (logs.length === 0) {
    logsTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9">A napló üres.</td>
      </tr>
    `;
    return;
  }

  logsTableBody.innerHTML = logs.map((l) => {
    const isSuccess = l.status === 'success';
    const statusBadge = isSuccess
      ? `<span class="badge-status success">${l.code || 200} OK</span>`
      : `<span class="badge-status error">${l.code || 'ERR'}</span>`;

    return `
      <tr>
        <td>${l.timestamp}</td>
        <td>#${l.workerId}</td>
        <td title="${l.model || ''}">${(l.model || '-').slice(0, 24)}</td>
        <td>${l.duration} ms</td>
        <td class="text-dim">${formatNum(l.promptTokens || 0)}</td>
        <td class="text-dim">${formatNum(l.completionTokens || 0)}</td>
        <td class="font-bold text-success">${formatNum(l.totalTokens || 0)}</td>
        <td>${statusBadge}</td>
        <td class="preview-cell" title="${escapeHtml(l.preview || l.message || '')}">${escapeHtml(l.preview || l.message || '-')}</td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// Minimal Canvas Chart
function initChart() {
  // Fill initial dummy zeros
  for (let i = 0; i < 40; i++) speedHistory.push(0);
  renderChart();
}

function renderChart() {
  const ctx = speedChart.getContext('2d');
  const w = speedChart.width;
  const h = speedChart.height;

  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(1000, ...speedHistory) * 1.15;
  const stepX = w / (speedHistory.length - 1);

  // Background subtle grid lines
  ctx.strokeStyle = '#1e2337';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 0.25; y <= 1; y += 0.25) {
    const py = h - y * h;
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
  }
  ctx.stroke();

  // Create flame gradient for area fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255, 85, 0, 0.45)');
  grad.addColorStop(0.6, 'rgba(255, 140, 0, 0.15)');
  grad.addColorStop(1, 'rgba(255, 68, 0, 0.0)');

  // Draw area
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < speedHistory.length; i++) {
    const x = i * stepX;
    const y = h - (speedHistory[i] / maxVal) * (h - 20) - 10;
    if (i === 0) ctx.lineTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw Stroke line
  ctx.beginPath();
  for (let i = 0; i < speedHistory.length; i++) {
    const x = i * stepX;
    const y = h - (speedHistory[i] / maxVal) * (h - 20) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#ff7700';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ff5500';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Start
init();

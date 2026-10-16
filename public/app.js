// OmniRoute Token Burner - Web Frontend Client
let isRunning = false;
let currentMode = 'infinite';
let eventSource = null;
let speedHistory = []; // Last 50 seconds
let peakSpeed = 0;
let logs = [];

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const statusText = connectionStatus.querySelector('.status-text');
const engineStatusBadge = document.getElementById('engineStatusBadge');
const engineStatusText = document.getElementById('engineStatusText');
const btnShutdownServer = document.getElementById('btnShutdownServer');

const valTotalBurned = document.getElementById('valTotalBurned');
const valPromptTokens = document.getElementById('valPromptTokens');
const valCompletionTokens = document.getElementById('valCompletionTokens');
const valSpeed = document.getElementById('valSpeed');
const valReqSpeed = document.getElementById('valReqSpeed');
const valWorkers = document.getElementById('valWorkers');
const valSuccessCount = document.getElementById('valSuccessCount');
const valErrorCount = document.getElementById('valErrorCount');
const valElapsed = document.getElementById('valElapsed');
const valModeLabel = document.getElementById('valModeLabel');

const progressBarContainer = document.getElementById('progressBarContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressLabel = document.getElementById('progressLabel');

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const lockedNotice = document.getElementById('lockedNotice');
const controlsFieldSet = document.getElementById('controlsFieldSet');
const btnClearLogs = document.getElementById('btnClearLogs');
const btnRefreshModels = document.getElementById('btnRefreshModels');
const refreshIcon = document.getElementById('refreshIcon');

const modelSelect = document.getElementById('modelSelect');
const recommendedGroup = document.getElementById('recommendedGroup');
const otherModelsGroup = document.getElementById('otherModelsGroup');
const customModelInput = document.getElementById('customModelInput');
const btnApplyCustomModel = document.getElementById('btnApplyCustomModel');

const batchSizeSelect = document.getElementById('batchSizeSelect');
const concurrencySlider = document.getElementById('concurrencySlider');
const concurrencyValue = document.getElementById('concurrencyValue');

const targetOptions = document.getElementById('targetOptions');
const targetTokensInput = document.getElementById('targetTokensInput');
const durationOptions = document.getElementById('durationOptions');
const durationMinutesInput = document.getElementById('durationMinutesInput');

const apiUrlInput = document.getElementById('apiUrlInput');
const apiKeyInput = document.getElementById('apiKeyInput');
const btnToggleKeyVis = document.getElementById('btnToggleKeyVis');

const logsTableBody = document.getElementById('logsTableBody');
const logCountLabel = document.getElementById('logCountLabel');
const speedChart = document.getElementById('speedChart');
const chartPeakSpeed = document.getElementById('chartPeakSpeed');

// Format numbers with comma separator
function formatNum(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('en-US');
}

// Format seconds into HH:MM:SS
function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// Event Listeners
function setupEvents() {
  btnStart.addEventListener('click', startBurn);
  btnStop.addEventListener('click', stopBurn);

  if (btnShutdownServer) {
    btnShutdownServer.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to shut down the Token Burner server?')) return;
      try {
        await fetch('/api/shutdown', { method: 'POST' });
        alert('Server has shut down. You may close this tab.');
      } catch {
        alert('Shutdown command sent.');
      }
    });
  }

  // Concurrency slider
  concurrencySlider.addEventListener('input', (e) => {
    concurrencyValue.textContent = `${e.target.value} threads`;
  });

  // Concurrency presets
  document.querySelectorAll('.btn-preset-thread').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (controlsFieldSet.disabled) return;
      const t = btn.dataset.threads;
      concurrencySlider.value = t;
      concurrencyValue.textContent = `${t} threads`;
    });
  });

  // Mode segmented control
  document.querySelectorAll('#modeSelector .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (controlsFieldSet.disabled) return;
      document.querySelectorAll('#modeSelector .seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;
      updateModeUI();
    });
  });

  // Target presets
  document.querySelectorAll('.btn-preset-token').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (controlsFieldSet.disabled) return;
      targetTokensInput.value = btn.dataset.val;
      valModeLabel.textContent = `Goal: ${formatNum(btn.dataset.val)} tok`;
    });
  });

  // Duration presets
  document.querySelectorAll('.btn-preset-time').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (controlsFieldSet.disabled) return;
      durationMinutesInput.value = btn.dataset.val;
      valModeLabel.textContent = `Timed: ${btn.dataset.val} min`;
    });
  });

  // Custom model addition
  btnApplyCustomModel.addEventListener('click', () => {
    const custom = customModelInput.value.trim();
    if (!custom) return;

    let existingOpt = Array.from(modelSelect.options).find((o) => o.value === custom);
    if (!existingOpt) {
      existingOpt = document.createElement('option');
      existingOpt.value = custom;
      existingOpt.textContent = `★ ${custom}`;
      recommendedGroup.prepend(existingOpt);
    }
    modelSelect.value = custom;
    localStorage.setItem('omniroute_burner_model', custom);
    customModelInput.value = '';
  });

  // Save selected model to localStorage
  modelSelect.addEventListener('change', () => {
    localStorage.setItem('omniroute_burner_model', modelSelect.value);
  });

  // Refresh models from OmniRoute
  btnRefreshModels.addEventListener('click', async () => {
    refreshIcon.style.animation = 'flame-flicker 0.6s infinite';
    await fetchModels();
    refreshIcon.style.animation = '';
  });

  // Toggle API key visibility
  btnToggleKeyVis.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    btnToggleKeyVis.textContent = apiKeyInput.type === 'password' ? '👁' : '🔒';
  });

  // Clear logs
  btnClearLogs.addEventListener('click', () => {
    logs = [];
    renderLogs();
  });
}

function updateModeUI() {
  if (currentMode === 'target') {
    targetOptions.style.display = 'block';
    durationOptions.style.display = 'none';
    valModeLabel.textContent = `Goal: ${formatNum(targetTokensInput.value)} tok`;
    progressLabel.textContent = 'Token Goal Progress';
  } else if (currentMode === 'duration') {
    targetOptions.style.display = 'none';
    durationOptions.style.display = 'block';
    valModeLabel.textContent = `Timed: ${durationMinutesInput.value} min`;
    progressLabel.textContent = 'Duration Elapsed';
  } else {
    targetOptions.style.display = 'none';
    durationOptions.style.display = 'none';
    valModeLabel.textContent = 'Continuous';
    progressBarContainer.style.display = 'none';
  }
}

// Initial status fetch
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const engine = data.engine || {};
    const defaults = data.detectedDefaults || {};

    if (defaults.apiKey && !apiKeyInput.value) {
      apiKeyInput.value = defaults.apiKey;
    }
    if (defaults.baseURL && !apiUrlInput.value) {
      apiUrlInput.value = defaults.baseURL;
    }

    const savedModel = localStorage.getItem('omniroute_burner_model');
    if (savedModel) {
      ensureOptionExists(savedModel);
      modelSelect.value = savedModel;
    } else if (defaults.preferredModel) {
      ensureOptionExists(defaults.preferredModel);
      modelSelect.value = defaults.preferredModel;
    }

    if (engine.isRunning) {
      applyEngineRunningState(true);
      applyStatsUpdate(engine);
    }
  } catch (err) {
    console.error('Failed to load status:', err);
  }
}

function ensureOptionExists(modelId) {
  const exists = Array.from(modelSelect.options).some((o) => o.value === modelId);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = modelId;
    opt.textContent = `★ ${modelId}`;
    recommendedGroup.prepend(opt);
  }
}

// Fetch models from OmniRoute
async function fetchModels() {
  try {
    const baseURL = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const url = `/api/models?baseURL=${encodeURIComponent(baseURL)}&apiKey=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) return;

    const data = await res.json();
    const currentVal = modelSelect.value;
    const recommended = data.recommended || [];
    const others = data.others || [];

    recommendedGroup.innerHTML = '';
    otherModelsGroup.innerHTML = '';

    for (const m of recommended) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.id}`;
      recommendedGroup.appendChild(opt);
    }

    for (const m of others) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id;
      otherModelsGroup.appendChild(opt);
    }

    if (currentVal && Array.from(modelSelect.options).some((o) => o.value === currentVal)) {
      modelSelect.value = currentVal;
    } else {
      const saved = localStorage.getItem('omniroute_burner_model');
      if (saved && Array.from(modelSelect.options).some((o) => o.value === saved)) {
        modelSelect.value = saved;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch models:', err);
  }
}

// Server-Sent Events (SSE) telemetry connection
function initSSE() {
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
    statusText.textContent = 'Disconnected';
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
    if (info.reason === 'target_reached') {
      alert(`🎯 Congratulations! Token target reached: ${formatNum(info.totalTokensBurned)} tokens burned!`);
    } else if (info.reason === 'duration_reached') {
      alert(`⏱ Burn session completed! Total burned: ${formatNum(info.totalTokensBurned)} tokens.`);
    } else if (info.reason === 'context_length_exceeded') {
      alert('⚠️ Selected model context length exceeded. Please choose a smaller payload size (Large or Normal).');
    }
  });
}

function applyEngineRunningState(running) {
  isRunning = running;
  if (running) {
    btnStart.style.display = 'none';
    btnStop.style.display = 'inline-flex';
    lockedNotice.style.display = 'flex';
    controlsFieldSet.disabled = true;
    engineStatusBadge.className = 'engine-badge burning';
    engineStatusText.textContent = '🔥 BURNING IN PROGRESS';
  } else {
    btnStart.style.display = 'inline-flex';
    btnStop.style.display = 'none';
    lockedNotice.style.display = 'none';
    controlsFieldSet.disabled = false;
    engineStatusBadge.className = 'engine-badge';
    engineStatusText.textContent = 'IDLE';
  }
}

function applyStatsUpdate(stats) {
  valTotalBurned.textContent = formatNum(stats.totalTokensBurned || 0);
  valPromptTokens.textContent = formatNum(stats.totalPromptTokens || 0);
  valCompletionTokens.textContent = formatNum(stats.totalCompletionTokens || 0);

  const speed = stats.tokensPerSecond || 0;
  valSpeed.innerHTML = `${formatNum(speed)} <small>tok/s</small>`;
  valReqSpeed.textContent = stats.requestsPerSecond || 0;

  valWorkers.textContent = `${stats.activeWorkers || 0} / ${stats.concurrency || concurrencySlider.value}`;
  valSuccessCount.textContent = formatNum(stats.successfulRequests || 0);
  valErrorCount.textContent = formatNum(stats.failedRequests || 0);

  valElapsed.textContent = formatTime(stats.elapsedSeconds || 0);

  // Speed history for chart
  if (stats.isRunning) {
    speedHistory.push(speed);
    if (speedHistory.length > 50) speedHistory.shift();
    if (speed > peakSpeed) {
      peakSpeed = speed;
      chartPeakSpeed.textContent = `Peak: ${formatNum(peakSpeed)} tok/s`;
    }
    renderChart();
  }

  // Progress Bar for Target or Duration modes
  if (stats.mode === 'target') {
    progressBarContainer.style.display = 'block';
    progressLabel.textContent = 'Token Goal Progress';
    const pct = stats.percentComplete || 0;
    progressFill.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;

    const remaining = stats.targetTokens - stats.totalTokensBurned;
    if (remaining > 0 && stats.remainingSeconds) {
      valModeLabel.textContent = `Remaining: ~${formatTime(stats.remainingSeconds)}`;
    } else {
      valModeLabel.textContent = `Goal: ${formatNum(stats.targetTokens)} tok`;
    }
  } else if (stats.mode === 'duration') {
    progressBarContainer.style.display = 'block';
    progressLabel.textContent = 'Duration Elapsed';
    const pct = stats.percentComplete || 0;
    progressFill.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;

    if (stats.remainingSeconds !== null && stats.remainingSeconds !== undefined) {
      valModeLabel.textContent = `Remaining: ~${formatTime(stats.remainingSeconds)}`;
    }
  } else {
    progressBarContainer.style.display = 'none';
  }
}

async function startBurn() {
  const model = modelSelect.value;
  localStorage.setItem('omniroute_burner_model', model);

  const payload = {
    baseURL: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    model: model,
    batchSize: batchSizeSelect.value,
    concurrency: parseInt(concurrencySlider.value, 10),
    mode: currentMode,
    targetTokens: parseInt(targetTokensInput.value, 10) || 1000000,
    durationMinutes: parseFloat(durationMinutesInput.value) || 30
  };

  btnStart.disabled = true;
  try {
    const res = await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(`Launch error: ${data.error || 'Unknown error'}`);
    }
  } catch (err) {
    alert(`Could not connect to server: ${err.message}`);
  } finally {
    btnStart.disabled = false;
  }
}

async function stopBurn() {
  btnStop.disabled = true;
  try {
    await fetch('/api/stop', { method: 'POST' });
  } catch (err) {
    console.error('Failed to stop:', err);
  } finally {
    btnStop.disabled = false;
  }
}

// Log table entries
function addLogEntry(log) {
  logs.unshift(log);
  if (logs.length > 25) logs.pop();
  renderLogs();
}

function renderLogs() {
  if (logs.length === 0) {
    logsTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">System is idle. Click “START BURNING” to initiate.</td>
      </tr>
    `;
    logCountLabel.textContent = '0 requests';
    return;
  }

  logCountLabel.textContent = `${logs.length} requests logged`;

  logsTableBody.innerHTML = logs.map((log) => {
    const isOk = log.status === 'success';
    const badgeClass = isOk ? 'badge-success' : 'badge-error';
    const statusText = isOk ? `OK (${log.code})` : `ERR (${log.code})`;
    const preview = log.preview || log.message || '';
    const tokensDisplay = isOk ? `<b>${formatNum(log.totalTokens)}</b>` : '-';

    return `
      <tr>
        <td class="font-mono text-dim">${log.timestamp}</td>
        <td class="font-mono">#${log.workerId + 1}</td>
        <td class="font-mono text-sm">${log.model || '-'}</td>
        <td class="font-mono">${log.duration} ms</td>
        <td class="font-mono text-flame">${tokensDisplay}</td>
        <td><span class="status-pill ${badgeClass}">${statusText}</span></td>
        <td class="log-preview" title="${preview.replace(/"/g, '&quot;')}">${preview}</td>
      </tr>
    `;
  }).join('');
}

// Speed Chart Rendering
function renderChart() {
  if (!speedChart) return;
  const ctx = speedChart.getContext('2d');
  const w = speedChart.width;
  const h = speedChart.height;

  ctx.clearRect(0, 0, w, h);

  if (speedHistory.length < 2) return;

  const maxVal = Math.max(1000, peakSpeed * 1.1);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = h - (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Smooth curve
  ctx.beginPath();
  const step = w / (speedHistory.length - 1);

  speedHistory.forEach((val, i) => {
    const x = i * step;
    const y = h - (val / maxVal) * (h - 20) - 10;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevX = (i - 1) * step;
      const prevY = h - (speedHistory[i - 1] / maxVal) * (h - 20) - 10;
      const cpX = (prevX + x) / 2;
      ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
    }
  });

  ctx.strokeStyle = '#ff5500';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(255, 85, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Gradient fill under curve
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255, 85, 0, 0.25)');
  grad.addColorStop(1, 'rgba(255, 85, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fill();
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  await loadStatus();
  await fetchModels();
  initSSE();
  renderChart();
});

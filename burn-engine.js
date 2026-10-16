import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

// Sűrű, szintetikus tudásbázis a gyors prompt égetéshez
const TECHNICAL_CORPUS_BASE = [
  "In the formal analysis of computational complexity, the distinction between deterministic polynomial time (P) and non-deterministic polynomial time (NP) remains the most prominent open problem in theoretical computer science. An algorithm operates within time complexity O(n^k) where n is the input parameter dimension and k is an invariant exponent.",
  "Thermodynamic entropy represents the microscopic degeneracy of states accessible to a macroscopic thermodynamic manifold. Under Boltzmann's foundational formulation S = k_B * ln(Omega), the logarithmic scale maps macrostates directly onto microstate combinatorics, inherently coupling information theory and physical state preservation.",
  "Distributed consensus algorithms operating within asynchronous networks must navigate the FLP impossibility theorem, which asserts that no deterministic asynchronous protocol can guarantee consensus in the presence of even a single unannounced fail-stop processor fault. Paxos and Raft circumvent this by establishing weak synchrony guarantees or randomized leader elections.",
  "High-throughput low-latency inference architectures for generative transformer models require continuous batching, PagedAttention mechanisms, and specialized kernel fusions (e.g., FlashAttention-3). Memory bandwidth constraints during auto-regressive decoding phase dominate over compute FLOPs.",
  "Modern high-frequency quantitative market making utilizes stochastic differential equations, specifically Ornstein-Uhlenbeck mean-reverting jump diffusion processes, to model the instantaneous limit order book micro-structure and evaluate toxic flow probabilities.",
  "Advanced compiler optimization passes perform static single assignment (SSA) transformations, dominance frontier analyses, dead-code elimination, and polyhedral loop auto-parallelization to maximize instruction-level parallelism (ILP) and cache hierarchy utilization."
].join(' ');

// Előre összeállított korpusz szövegek a maximális sebességért (minimális CPU terhelés a ciklusban)
const CORPUS_NORMAL = TECHNICAL_CORPUS_BASE.repeat(16);  // ~15 000 token
const CORPUS_LARGE = TECHNICAL_CORPUS_BASE.repeat(36);   // ~35 000 token
const CORPUS_MONSTER = TECHNICAL_CORPUS_BASE.repeat(68); // ~65 000 token

// Segédfüggvény: azonnal megszakítható várakozás abort jelzésre
function abortableSleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let timer = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class BurnEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.baseURL = (options.baseURL || 'http://localhost:20128/v1').replace(/\/+$/, '');
    if (!this.baseURL.endsWith('/v1') && !this.baseURL.includes('/v1')) {
      this.baseURL += '/v1';
    }
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'auto/fast';
    this.concurrency = Math.max(1, Math.min(64, Number(options.concurrency) || 8));
    this.batchSize = options.batchSize || 'monster'; // 'monster' (~65k) | 'large' (~35k) | 'normal' (~15k)
    this.mode = options.mode || 'infinite'; // 'infinite' | 'target' | 'duration'
    this.targetTokens = Number(options.targetTokens) || 1_000_000;
    this.durationMs = (Number(options.durationMinutes) || (Number(options.durationHours) * 60) || 30) * 60 * 1000;
    this.maxTokens = 16; // Gyors válaszgenerálás a maximális prompt égetési sebességért

    // Állapotkövetés
    this.isRunning = false;
    this.currentSessionId = null;
    this.startTime = null;
    this.stopTime = null;
    this.workers = [];
    this.abortController = null;
    this.reqCounter = 0;
    this.consecutiveErrors = 0;

    // Statisztika
    this.stats = {
      totalTokensBurned: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      tokensPerSecond: 0,
      requestsPerSecond: 0,
      elapsedSeconds: 0,
      remainingSeconds: null,
      percentComplete: null,
      activeWorkers: 0,
      recentLogs: []
    };

    // Gördülő mintaablak a pontos átviteli sebesség méréséhez
    this.rollingSamples = [];
    this.statsInterval = null;
  }

  updateConfig(newConfig = {}) {
    if (newConfig.baseURL) {
      let b = newConfig.baseURL.replace(/\/+$/, '');
      if (!b.endsWith('/v1') && !b.includes('/v1')) b += '/v1';
      this.baseURL = b;
    }
    if (newConfig.apiKey !== undefined) this.apiKey = newConfig.apiKey;
    if (newConfig.model) this.model = newConfig.model;
    if (newConfig.concurrency) this.concurrency = Math.max(1, Math.min(64, Number(newConfig.concurrency)));
    if (newConfig.batchSize) this.batchSize = newConfig.batchSize;
    if (newConfig.mode) this.mode = newConfig.mode;
    if (newConfig.targetTokens) this.targetTokens = Number(newConfig.targetTokens);
    if (newConfig.durationMinutes) {
      this.durationMs = Number(newConfig.durationMinutes) * 60 * 1000;
    } else if (newConfig.durationHours) {
      this.durationMs = Number(newConfig.durationHours) * 3600 * 1000;
    }
  }

  getCorpus() {
    switch (this.batchSize) {
      case 'normal':
        return CORPUS_NORMAL;
      case 'large':
        return CORPUS_LARGE;
      case 'monster':
      default:
        return CORPUS_MONSTER;
    }
  }

  generatePayload(workerId = 0) {
    const nonce = `[BURN_ENTROPY:${Date.now()}-${workerId}-${++this.reqCounter}-${crypto.randomBytes(4).toString('hex')}]`;
    const corpus = this.getCorpus();

    return {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an ultra-high performance AI processing benchmark. Analyze the provided knowledge base concisely in under 10 words.'
        },
        {
          role: 'user',
          content: `${nonce}\nAnalyze following technical specification and provide 1 core insight:\n\n${corpus}`
        }
      ],
      max_tokens: this.maxTokens,
      temperature: 0.5,
      stream: false
    };
  }

  async start() {
    // Ha már fut, tiszta leállítás először
    if (this.isRunning) {
      await this.stop('újraindítás');
    }

    this.isRunning = true;
    const sessionId = crypto.randomUUID();
    this.currentSessionId = sessionId;
    this.startTime = Date.now();
    this.stopTime = null;
    this.abortController = new AbortController();
    this.rollingSamples = [];
    this.consecutiveErrors = 0;

    // Munkamenet statisztika nullázása
    this.stats.totalTokensBurned = 0;
    this.stats.totalPromptTokens = 0;
    this.stats.totalCompletionTokens = 0;
    this.stats.totalRequests = 0;
    this.stats.successfulRequests = 0;
    this.stats.failedRequests = 0;
    this.stats.activeWorkers = 0;
    this.stats.recentLogs = [];

    this.emit('started', {
      model: this.model,
      mode: this.mode,
      concurrency: this.concurrency,
      batchSize: this.batchSize
    });

    // Háttér statisztika frissítés (500 ms)
    this.statsInterval = setInterval(() => {
      this.computeMetrics();
      this.emit('stats', this.getStats());

      // Cél elérése ellenőrzése
      if (this.mode === 'target' && this.stats.totalTokensBurned >= this.targetTokens) {
        this.stop('target_reached');
      } else if (this.mode === 'duration') {
        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.durationMs) {
          this.stop('duration_reached');
        }
      }
    }, 500);

    // Munkaszálak (workers) indítása fokozatos eltolással
    this.workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      this.workers.push(this.runWorkerLoop(i, sessionId));
    }
  }

  async runWorkerLoop(workerId, sessionId) {
    const signal = this.abortController?.signal;

    // Szálankénti indítási eltolás (50 ms szálanként, max 1.5 másodpercig)
    const initialDelay = Math.min(1500, workerId * 50);
    if (initialDelay > 0) {
      await abortableSleep(initialDelay, signal);
    }

    while (this.isRunning && this.currentSessionId === sessionId && !signal?.aborted) {
      // Célok ellenőrzése kérés előtt
      if (this.mode === 'target' && this.stats.totalTokensBurned >= this.targetTokens) {
        this.stop('target_reached');
        break;
      }
      if (this.mode === 'duration' && (Date.now() - this.startTime) >= this.durationMs) {
        this.stop('duration_reached');
        break;
      }

      this.stats.activeWorkers++;
      const reqStart = Date.now();
      let logEntry = null;

      try {
        const payload = this.generatePayload(workerId);
        const endpoint = `${this.baseURL}/chat/completions`;

        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        // Kérés időtúllépés: 25 mp kérésenként
        const timeoutSignal = AbortSignal.timeout(25000);
        const combinedSignal = AbortSignal.any
          ? AbortSignal.any([signal, timeoutSignal])
          : signal;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: combinedSignal
        });

        const reqDuration = Date.now() - reqStart;

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Ismeretlen hiba');
          this.stats.totalRequests++;
          this.stats.failedRequests++;
          this.consecutiveErrors++;

          let userFriendlyMsg = `HTTP ${response.status}: ${errText.slice(0, 140)}`;
          if (response.status === 401) {
            userFriendlyMsg = 'Érvénytelen API kulcs! (401 Unauthorized)';
          } else if (response.status === 404) {
            userFriendlyMsg = `A megadott modell (${this.model}) nem található (404)!`;
          } else if (response.status === 400 && (errText.includes('context') || errText.includes('tokens') || errText.includes('maximum'))) {
            userFriendlyMsg = 'A modell nem támogatja ezt a prompt méretet! Válassz kisebb csomagméretet (Nagy vagy Normál)!';
          } else if (response.status === 429) {
            userFriendlyMsg = 'Túl sok kérés (429 Rate Limit) - automatikus várakozás...';
          }

          logEntry = {
            id: crypto.randomUUID().slice(0, 8),
            workerId,
            timestamp: new Date().toLocaleTimeString('hu-HU'),
            duration: reqDuration,
            status: 'error',
            code: response.status,
            message: userFriendlyMsg,
            tokens: 0
          };
          this.pushLog(logEntry);
          this.emit('request_failed', logEntry);

          // Leállás hibás hitelesítés vagy hiányzó modell esetén
          if (response.status === 401 || response.status === 404) {
            await this.stop(`hiba_${response.status}`);
            break;
          }

          // Ha túl sok 400-as kontextus hiba érkezik, azonnali tiszta leállás
          if (this.consecutiveErrors >= 6 && response.status === 400) {
            await this.stop('context_length_exceeded');
            break;
          }

          // Biztonságos várakozás hiba esetén
          if (response.status === 429 || response.status === 503) {
            await abortableSleep(2000, signal);
          } else {
            await abortableSleep(500, signal);
          }
          continue;
        }

        const data = await response.json();
        const usage = data.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

        this.consecutiveErrors = 0;
        this.stats.totalRequests++;
        this.stats.successfulRequests++;
        this.stats.totalTokensBurned += totalTokens;
        this.stats.totalPromptTokens += promptTokens;
        this.stats.totalCompletionTokens += completionTokens;

        // Statisztikai gördülő minta mentése
        this.rollingSamples.push({
          time: Date.now(),
          tokens: totalTokens
        });

        const replyContent = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '(ok)';
        const preview = replyContent.replace(/\s+/g, ' ').trim().slice(0, 75);

        logEntry = {
          id: crypto.randomUUID().slice(0, 8),
          workerId,
          timestamp: new Date().toLocaleTimeString('hu-HU'),
          duration: reqDuration,
          status: 'success',
          code: response.status,
          model: data.model || this.model,
          promptTokens,
          completionTokens,
          totalTokens,
          preview
        };

        this.pushLog(logEntry);
        this.emit('request_success', logEntry);
      } catch (err) {
        if (err.name === 'AbortError' || signal?.aborted || !this.isRunning) {
          break;
        }

        this.stats.totalRequests++;
        this.stats.failedRequests++;
        this.consecutiveErrors++;

        let errorMsg = err.message || String(err);
        if (err.name === 'TimeoutError' || errorMsg.includes('timeout')) {
          errorMsg = 'Időtúllépés (25 mp). Az OmniRoute / modell lassú vagy foglalt.';
        } else if (errorMsg.includes('fetch failed')) {
          errorMsg = 'Hálózati hiba (kapcsolat megszakadt vagy az OmniRoute nem elérhető).';
        }

        logEntry = {
          id: crypto.randomUUID().slice(0, 8),
          workerId,
          timestamp: new Date().toLocaleTimeString('hu-HU'),
          duration: Date.now() - reqStart,
          status: 'error',
          code: 'FETCH_ERR',
          message: errorMsg,
          tokens: 0
        };

        this.pushLog(logEntry);
        this.emit('request_failed', logEntry);

        // Rövid várakozás hálózati hiba esetén
        await abortableSleep(1000, signal);
      } finally {
        this.stats.activeWorkers = Math.max(0, this.stats.activeWorkers - 1);
      }
    }
  }

  pushLog(entry) {
    this.stats.recentLogs.unshift(entry);
    if (this.stats.recentLogs.length > 30) {
      this.stats.recentLogs.pop();
    }
  }

  computeMetrics() {
    if (!this.startTime) return;
    const now = Date.now();
    const elapsedMs = (this.stopTime || now) - this.startTime;
    this.stats.elapsedSeconds = Math.max(1, Math.round(elapsedMs / 1000));

    // Gördülő ablak (utolsó 6 másodperc)
    const windowMs = 6000;
    const cutoff = now - windowMs;
    this.rollingSamples = this.rollingSamples.filter((s) => s.time >= cutoff);

    if (this.rollingSamples.length > 0) {
      const windowTokens = this.rollingSamples.reduce((sum, s) => sum + s.tokens, 0);
      const spanSec = Math.max(1, Math.min(this.stats.elapsedSeconds, windowMs / 1000));
      this.stats.tokensPerSecond = Math.round(windowTokens / spanSec);
      this.stats.requestsPerSecond = Number((this.rollingSamples.length / spanSec).toFixed(1));
    } else if (this.isRunning) {
      this.stats.tokensPerSecond = Math.round(this.stats.totalTokensBurned / this.stats.elapsedSeconds);
      this.stats.requestsPerSecond = Number((this.stats.totalRequests / this.stats.elapsedSeconds).toFixed(1));
    } else {
      this.stats.tokensPerSecond = 0;
      this.stats.requestsPerSecond = 0;
    }

    if (this.mode === 'target') {
      const pct = Math.min(100, (this.stats.totalTokensBurned / this.targetTokens) * 100);
      this.stats.percentComplete = Number(pct.toFixed(1));
      if (this.stats.tokensPerSecond > 0 && this.stats.totalTokensBurned < this.targetTokens) {
        const remainingTokens = this.targetTokens - this.stats.totalTokensBurned;
        this.stats.remainingSeconds = Math.round(remainingTokens / this.stats.tokensPerSecond);
      } else {
        this.stats.remainingSeconds = 0;
      }
    } else if (this.mode === 'duration') {
      const pct = Math.min(100, (elapsedMs / this.durationMs) * 100);
      this.stats.percentComplete = Number(pct.toFixed(1));
      this.stats.remainingSeconds = Math.max(0, Math.round((this.durationMs - elapsedMs) / 1000));
    } else {
      this.stats.percentComplete = null;
      this.stats.remainingSeconds = null;
    }
  }

  async stop(reason = 'user_stopped') {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.stopTime = Date.now();

    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Minden szál tiszta leállásának megvárása
    if (this.workers.length > 0) {
      await Promise.allSettled(this.workers);
      this.workers = [];
    }

    this.stats.activeWorkers = 0;
    this.computeMetrics();
    this.emit('stopped', {
      reason,
      totalTokensBurned: this.stats.totalTokensBurned,
      elapsedSeconds: this.stats.elapsedSeconds,
      successfulRequests: this.stats.successfulRequests
    });
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      model: this.model,
      concurrency: this.concurrency,
      batchSize: this.batchSize,
      mode: this.mode,
      targetTokens: this.targetTokens,
      durationMs: this.durationMs,
      ...this.stats
    };
  }
}

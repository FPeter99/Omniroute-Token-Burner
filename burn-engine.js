import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

// Dictionary of text blocks for massive prompt generation
const CODE_SNIPPETS = [
  `function solveTravelingSalespersonProblem(graph, startNode) {
    const n = graph.length;
    const memo = new Map();
    function tsp(mask, pos) {
      if (mask === (1 << n) - 1) return graph[pos][startNode] || Infinity;
      const key = \`\${mask}-\${pos}\`;
      if (memo.has(key)) return memo.get(key);
      let ans = Infinity;
      for (let next = 0; next < n; next++) {
        if ((mask & (1 << next)) === 0 && graph[pos][next] > 0) {
          const newCost = graph[pos][next] + tsp(mask | (1 << next), next);
          ans = Math.min(ans, newCost);
        }
      }
      memo.set(key, ans);
      return ans;
    }
    return tsp(1 << startNode, startNode);
  }`,
  `class QuantumCircuitSimulator {
    constructor(qubits) {
      this.qubits = qubits;
      this.state = new Float64Array(1 << (qubits * 2));
      this.state[0] = 1.0;
    }
    applyHadamard(target) {
      const invSqrt2 = 1.0 / Math.SQRT2;
      for (let i = 0; i < (1 << this.qubits); i++) {
        if ((i & (1 << target)) === 0) {
          const j = i | (1 << target);
          const u0 = this.state[i * 2];
          const u1 = this.state[j * 2];
          this.state[i * 2] = invSqrt2 * (u0 + u1);
          this.state[j * 2] = invSqrt2 * (u0 - u1);
        }
      }
    }
  }`,
  `type Matrix4x4 = [[number, number, number, number], [number, number, number, number], [number, number, number, number], [number, number, number, number]];
  function multiplyMatrices(a: Matrix4x4, b: Matrix4x4): Matrix4x4 {
    const result = Array.from({ length: 4 }, () => new Array(4).fill(0)) as Matrix4x4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        for (let k = 0; k < 4; k++) {
          result[r][c] += a[r][k] * b[k][c];
        }
      }
    }
    return result;
  }`
];

const KNOWLEDGE_PARAGRAPHS = [
  "In the formal analysis of computational complexity, the distinction between deterministic polynomial time (P) and non-deterministic polynomial time (NP) remains the most prominent open problem in theoretical computer science. An algorithm operates within time complexity O(n^k) where n is the input parameter dimension and k is an invariant exponent.",
  "Thermodynamic entropy represents the microscopic degeneracy of states accessible to a macroscopic thermodynamic manifold. Under Boltzmann's foundational formulation S = k_B * ln(Omega), the logarithmic scale maps macrostates directly onto microstate combinatorics, inherently coupling information theory and physical state preservation.",
  "Distributed consensus algorithms operating within asynchronous networks must navigate the FLP impossibility theorem, which asserts that no deterministic asynchronous protocol can guarantee consensus in the presence of even a single unannounced fail-stop processor fault. Paxos and Raft circumvent this by establishing weak synchrony guarantees or randomized leader elections.",
  "High-throughput low-latency inference architectures for generative transformer models require continuous batching, PagedAttention mechanisms, and specialized kernel fusions (e.g., FlashAttention-3). Memory bandwidth constraints during auto-regressive decoding phase dominate over compute FLOPs.",
  "Modern high-frequency quantitative market making utilizes stochastic differential equations, specifically Ornstein-Uhlenbeck mean-reverting jump diffusion processes, to model the instantaneous limit order book micro-structure and evaluate toxic flow probabilities.",
  "Advanced compiler optimization passes perform static single assignment (SSA) transformations, loop unrolling, polyhedral loop transformations, and inter-procedural escape analysis to minimize pipeline stalls and register spills on deeply pipelined superscalar execution units."
];

export class BurnEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.baseURL = options.baseURL || 'http://localhost:20128/v1';
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'fp99/spam';
    this.concurrency = Math.max(1, Math.min(60, Number(options.concurrency) || 8));
    this.mode = options.mode || 'infinite'; // 'target' | 'duration' | 'infinite'
    this.targetTokens = Number(options.targetTokens) || 1_000_000;
    this.durationMs = (Number(options.durationHours) || 1) * 3600 * 1000;
    this.burnStrategy = options.burnStrategy || 'prompt_heavy'; // 'hyper_speed' | 'prompt_heavy' | 'output_heavy' | 'balanced' | 'extreme'
    this.cacheBuster = options.cacheBuster !== false;
    this.maxTokens = Number(options.maxTokens) || 4096;

    // State tracking
    this.isRunning = false;
    this.startTime = null;
    this.stopTime = null;
    this.workers = [];
    this.abortController = null;

    // Statistics
    this.stats = {
      totalTokensBurned: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalCachedTokens: 0,
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

    // Rolling metrics window for accurate rate calculation (last 10s)
    this.rollingSamples = [];
    this.statsInterval = null;
  }

  updateConfig(newConfig = {}) {
    if (newConfig.baseURL) this.baseURL = newConfig.baseURL.replace(/\/+$/, '');
    if (!this.baseURL.endsWith('/v1')) {
      if (!this.baseURL.includes('/v1')) this.baseURL += '/v1';
    }
    if (newConfig.apiKey !== undefined) this.apiKey = newConfig.apiKey;
    if (newConfig.model) this.model = newConfig.model;
    if (newConfig.concurrency) this.concurrency = Math.max(1, Math.min(60, Number(newConfig.concurrency)));
    if (newConfig.mode) this.mode = newConfig.mode;
    if (newConfig.targetTokens) this.targetTokens = Number(newConfig.targetTokens);
    if (newConfig.durationHours) this.durationMs = Number(newConfig.durationHours) * 3600 * 1000;
    if (newConfig.durationMinutes) this.durationMs = Number(newConfig.durationMinutes) * 60 * 1000;
    if (newConfig.burnStrategy) this.burnStrategy = newConfig.burnStrategy;
    if (newConfig.cacheBuster !== undefined) this.cacheBuster = Boolean(newConfig.cacheBuster);
    if (newConfig.maxTokens) this.maxTokens = Number(newConfig.maxTokens);
  }

  generatePromptPayload() {
    const salt = this.cacheBuster
      ? `\n[ENTROPY_SALT:${crypto.randomBytes(16).toString('hex')} | TIMESTAMP:${Date.now()} | NONCE:${crypto.randomUUID()}]\n`
      : '';

    let instruction = '';
    let promptText = '';
    let maxTokens = this.maxTokens;

    switch (this.burnStrategy) {
      case 'hyper_speed': {
        // Fast burst: ~2,000 prompt tokens, short output -> ultra fast turnaround (1-2s)
        maxTokens = 64;
        instruction = 'Briefly extract 2 key architectural tenets from the following text:';
        const repeats = 6;
        const corpus = [];
        for (let i = 0; i < repeats; i++) {
          const para = KNOWLEDGE_PARAGRAPHS[i % KNOWLEDGE_PARAGRAPHS.length];
          corpus.push(`--- SECTION ${i + 1} ---\n${para}`);
        }
        promptText = `${salt}\n${instruction}\n\n${corpus.join('\n\n')}`;
        break;
      }
      case 'prompt_heavy': {
        // Massive input prompt (~7,000 - 10,000 tokens), fast output (128 max_tokens)
        maxTokens = Math.min(maxTokens, 128);
        instruction = 'Analyze the following comprehensive corpus thoroughly. Identify the 3 most critical theoretical intersections:';
        const repeats = 18;
        const corpus = [];
        for (let i = 0; i < repeats; i++) {
          const para = KNOWLEDGE_PARAGRAPHS[i % KNOWLEDGE_PARAGRAPHS.length];
          const code = CODE_SNIPPETS[i % CODE_SNIPPETS.length];
          corpus.push(`--- SECTION ${i + 1} [ID:${crypto.randomBytes(6).toString('hex')}] ---\n${para}\n\`\`\`typescript\n${code}\n\`\`\``);
        }
        promptText = `${salt}\n${instruction}\n\n${corpus.join('\n\n')}\n\nExecute detailed synthesis now.`;
        break;
      }
      case 'output_heavy': {
        // Small prompt, asks for massive exhaustive output
        maxTokens = Math.max(maxTokens, 4096);
        instruction = 'Write an exhaustively detailed, highly technical treatise covering distributed systems, operating system kernel architecture, and quantum algorithmic complexity. Do not summarize. Elaborate on every single sub-component with code examples and mathematical derivations until maximum context length is reached.';
        promptText = `${salt}\n${instruction}\nBegin with the microkernel memory management subsystem:`;
        break;
      }
      case 'extreme': {
        // Massive prompt AND massive output
        maxTokens = Math.max(maxTokens, 4096);
        instruction = 'Read all supplied system specifications, perform complete rigorous formal verification, and output a complete production-grade implementation of all described algorithms with exhaustive documentation:';
        const repeats = 28;
        const corpus = [];
        for (let i = 0; i < repeats; i++) {
          const para = KNOWLEDGE_PARAGRAPHS[i % KNOWLEDGE_PARAGRAPHS.length];
          const code = CODE_SNIPPETS[i % CODE_SNIPPETS.length];
          corpus.push(`--- MODULE SPECIFICATION ${i + 1} ---\n${para}\n${code}`);
        }
        promptText = `${salt}\n${instruction}\n\n${corpus.join('\n\n')}\n\nGenerate full implementations:`;
        break;
      }
      case 'balanced':
      default: {
        // Medium prompt (~3,000 tokens), generous output (~1024 tokens)
        maxTokens = Math.min(maxTokens, 1024);
        instruction = 'Review the following multi-domain architectural notes and provide an in-depth breakdown of scaling bottlenecks:';
        const repeats = 8;
        const corpus = [];
        for (let i = 0; i < repeats; i++) {
          corpus.push(KNOWLEDGE_PARAGRAPHS[i % KNOWLEDGE_PARAGRAPHS.length]);
        }
        promptText = `${salt}\n${instruction}\n\n${corpus.join('\n\n')}`;
        break;
      }
    }

    return {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an advanced high-throughput research model. Follow instructions meticulously and generate thorough, in-depth technical analysis without unnecessary pleasantries.'
        },
        {
          role: 'user',
          content: promptText
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: false
    };
  }

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = Date.now();
    this.stopTime = null;
    this.abortController = new AbortController();
    this.rollingSamples = [];

    // Reset session stats if starting fresh
    this.stats.totalTokensBurned = 0;
    this.stats.totalPromptTokens = 0;
    this.stats.totalCompletionTokens = 0;
    this.stats.totalCachedTokens = 0;
    this.stats.totalRequests = 0;
    this.stats.successfulRequests = 0;
    this.stats.failedRequests = 0;
    this.stats.recentLogs = [];

    this.emit('started', {
      model: this.model,
      mode: this.mode,
      concurrency: this.concurrency,
      strategy: this.burnStrategy
    });

    // Start background stats ticker (every 500ms)
    this.statsInterval = setInterval(() => {
      this.computeMetrics();
      this.emit('stats', this.getStats());

      // Check termination conditions
      if (this.mode === 'duration') {
        const elapsed = Date.now() - this.startTime;
        if (elapsed >= this.durationMs) {
          this.stop('duration_reached');
        }
      } else if (this.mode === 'target') {
        if (this.stats.totalTokensBurned >= this.targetTokens) {
          this.stop('target_reached');
        }
      }
    }, 500);

    // Launch worker pool
    this.workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      this.workers.push(this.runWorkerLoop(i));
    }
  }

  async runWorkerLoop(workerId) {
    while (this.isRunning) {
      if (this.abortController?.signal?.aborted) break;

      // Check termination before making request
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
        const payload = this.generatePromptPayload();
        const endpoint = `${this.baseURL}/chat/completions`;

        const headers = {
          'Content-Type': 'application/json'
        };
        if (this.apiKey) {
          headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const reqSignal = AbortSignal.any
          ? AbortSignal.any([this.abortController.signal, AbortSignal.timeout(60000)])
          : this.abortController.signal;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: reqSignal
        });

        const reqDuration = Date.now() - reqStart;

        if (!response.ok) {
          const errText = await response.text().catch(() => 'Unknown error');
          this.stats.totalRequests++;
          this.stats.failedRequests++;

          logEntry = {
            id: crypto.randomUUID().slice(0, 8),
            workerId,
            timestamp: new Date().toLocaleTimeString(),
            duration: reqDuration,
            status: 'error',
            code: response.status,
            message: `HTTP ${response.status}: ${errText.slice(0, 160)}`,
            tokens: 0
          };
          this.pushLog(logEntry);
          this.emit('request_failed', logEntry);

          // Brief backoff on rate-limit (429) or server busy
          if (response.status === 429 || response.status === 503) {
            await new Promise((r) => setTimeout(r, 1500));
          } else {
            await new Promise((r) => setTimeout(r, 400));
          }
          continue;
        }

        const data = await response.json();
        const usage = data.usage || {};
        const promptTokens = usage.prompt_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (promptTokens + completionTokens);
        const cachedTokens = usage.prompt_tokens_details?.cached_tokens || 0;

        this.stats.totalRequests++;
        this.stats.successfulRequests++;
        this.stats.totalTokensBurned += totalTokens;
        this.stats.totalPromptTokens += promptTokens;
        this.stats.totalCompletionTokens += completionTokens;
        this.stats.totalCachedTokens += cachedTokens;

        // Record for rolling rate calculation
        this.rollingSamples.push({
          time: Date.now(),
          tokens: totalTokens
        });

        const replyContent = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '(empty response)';
        const preview = replyContent.replace(/\s+/g, ' ').trim().slice(0, 90);

        logEntry = {
          id: crypto.randomUUID().slice(0, 8),
          workerId,
          timestamp: new Date().toLocaleTimeString(),
          duration: reqDuration,
          status: 'success',
          code: response.status,
          model: data.model || this.model,
          promptTokens,
          completionTokens,
          totalTokens,
          preview: preview + (preview.length >= 90 ? '...' : '')
        };
        this.pushLog(logEntry);
        this.emit('request_success', logEntry);

        // Immediate check if target achieved
        if (this.mode === 'target' && this.stats.totalTokensBurned >= this.targetTokens) {
          this.stop('target_reached');
          break;
        }
      } catch (err) {
        if (err.name === 'AbortError' || this.abortController?.signal?.aborted) {
          break;
        }
        this.stats.totalRequests++;
        this.stats.failedRequests++;

        logEntry = {
          id: crypto.randomUUID().slice(0, 8),
          workerId,
          timestamp: new Date().toLocaleTimeString(),
          duration: Date.now() - reqStart,
          status: 'error',
          code: 'FETCH_ERROR',
          message: err.message || String(err),
          tokens: 0
        };
        this.pushLog(logEntry);
        this.emit('request_failed', logEntry);

        // Micro-pause on network errors
        await new Promise((r) => setTimeout(r, 1000));
      } finally {
        this.stats.activeWorkers = Math.max(0, this.stats.activeWorkers - 1);
      }
    }
  }

  pushLog(entry) {
    this.stats.recentLogs.unshift(entry);
    if (this.stats.recentLogs.length > 50) {
      this.stats.recentLogs.pop();
    }
  }

  computeMetrics() {
    if (!this.startTime) return;
    const now = Date.now();
    const elapsedMs = (this.stopTime || now) - this.startTime;
    this.stats.elapsedSeconds = Math.max(0.1, Math.round(elapsedMs / 1000));

    // Clean rolling samples older than 10 seconds
    const tenSecsAgo = now - 10000;
    this.rollingSamples = this.rollingSamples.filter((s) => s.time >= tenSecsAgo);

    if (this.rollingSamples.length > 0 && elapsedMs >= 1000) {
      const windowTokens = this.rollingSamples.reduce((sum, s) => sum + s.tokens, 0);
      const windowDurationSec = Math.max(1, (now - this.rollingSamples[0].time) / 1000);
      this.stats.tokensPerSecond = Math.round(windowTokens / windowDurationSec);
      this.stats.requestsPerSecond = Number((this.rollingSamples.length / windowDurationSec).toFixed(1));
    } else {
      this.stats.tokensPerSecond = Math.round(this.stats.totalTokensBurned / this.stats.elapsedSeconds);
      this.stats.requestsPerSecond = Number((this.stats.totalRequests / this.stats.elapsedSeconds).toFixed(1));
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
      const totalSec = Math.round(this.durationMs / 1000);
      const remainingSec = Math.max(0, totalSec - this.stats.elapsedSeconds);
      this.stats.remainingSeconds = remainingSec;
      const pct = Math.min(100, (this.stats.elapsedSeconds / totalSec) * 100);
      this.stats.percentComplete = Number(pct.toFixed(1));
    } else {
      this.stats.percentComplete = null;
      this.stats.remainingSeconds = null;
    }
  }

  stop(reason = 'user_stopped') {
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

    this.computeMetrics();
    this.emit('stopped', {
      reason,
      totalTokensBurned: this.stats.totalTokensBurned,
      totalRequests: this.stats.totalRequests,
      elapsedSeconds: this.stats.elapsedSeconds
    });
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      model: this.model,
      mode: this.mode,
      concurrency: this.concurrency,
      burnStrategy: this.burnStrategy,
      targetTokens: this.targetTokens,
      durationMs: this.durationMs,
      cacheBuster: this.cacheBuster,
      ...this.stats
    };
  }
}

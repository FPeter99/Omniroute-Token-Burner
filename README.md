# 🔥 OmniRoute Token Burner

High-velocity, parallelized AI token annihilator specifically designed for **OmniRoute** and OpenCode environments.

If you have multiple accounts connected to OmniRoute with excess/expiring tokens, this utility allows you to incinerate them at maximum throughput with customizable limits, strategies, and real-time telemetry.

---

## ⚡ Key Capabilities

1. **Three Operation Modes:**
   - ♾ **Open / Continuous Mode:** Burns tokens without stopping at maximum speed until manually halted.
   - 🎯 **Target Mode:** Specify an exact token count (e.g. `100,000`, `1,000,000`, `10,000,000`). Automatically terminates once the target is reached.
   - ⏱ **Duration Mode:** Timed burn session (e.g. `30 minutes`, `1 hour`, `6 hours`). Shuts down automatically when the timer expires.

2. **OmniRoute Compatibility & Multi-Stack Turbo Pool:**
   - Works seamlessly with your local OmniRoute router (`http://localhost:20128/v1`).
   - 🔄 **Dynamic Model Catalog:** Automatically detects all available models, aliases, and custom routing combos (`auto/fast`, `auto/best-coding`, user-defined combos, etc.) configured in your OmniRoute instance.
   - 🔥 **Multi-Stack Turbo Pool (Rotation):** Check multiple stacks/models simultaneously. Workers automatically distribute requests across chosen stacks to circumvent single-provider rate limits and achieve peak throughput.

3. **High-Velocity Burn Strategies & Prompt Bombs:**
   - 🚀 **Prompt Flooding:** Floods models with massive synthetic corpora (dense theoretical and mathematical data). Because LLMs process input tokens in parallel, prompt ingestion burns tens of thousands of tokens per second.
   - 💣 **Prompt Multiplier:** Adjust payload scale: Normal (1x, ~8k-10k tokens), Double (2x, ~16k-20k tokens), Brutal (4x, ~32k-40k tokens), and Monster (8x, ~64k-80k tokens per request).
   - ⚡ **Hyper-Speed:** Small prompts (~2,000 tokens) with rapid 1–2s turnaround.
   - ⚖️ **Balanced:** Balanced prompt and completion tokens.
   - 📜 **Output Exhaustion:** Forces models into long output generation (4,096–8,192 completion tokens).
   - 💥 **Extreme Chaos:** Maximum prompt combined with maximum generation length.

4. **🔥 Cache-Buster Protection:**
   - Injects unique cryptographic nonces, entropy timestamps, and randomized salts into every single prompt. This prevents providers from applying prompt-caching discounts, ensuring 100% full token billing.

5. **Up to 64 Concurrent Worker Threads:**
   - Run anywhere from 1 to 64 parallel threads. OmniRoute load-balances requests across all your accounts.

6. **Cyberpunk Web Dashboard:**
   - Real-time digital counters (Total Burned Tokens, Prompt vs Output split, Tokens/second velocity).
   - Canvas-based real-time throughput velocity wave.
   - Live request inspection table with response latency, token consumption, and snippets.
   - 📊 **Report Export:** One-click download of session statistics in JSON format.
   - 🔔 **Audio Alerts:** Synthesized chime plays upon reaching targets or timer completion.

---

## 🚀 How to Start and Stop the Web Server

### Starting the Web Dashboard:

#### Method 1: Windows (1-Click)
Double-click:
```cmd
start.bat
```

#### Method 2: PowerShell
Run in your PowerShell terminal:
```powershell
.\start.ps1
```
*(Automatically opens `http://localhost:4420` in your default browser and starts the Node.js server)*

#### Method 3: npm
```bash
npm start
```

---

### Stopping the Web Dashboard:

You can stop the server and any running background workers in three simple ways:

1. **From PowerShell / Terminal:**
   - If the server is running in the current window: press **`Ctrl + C`** (or close the window).
   - To stop the server from any other PowerShell window:
     ```powershell
     .\stop.ps1
     ```
     *(Or double-click `stop.bat` or run `npm run stop`)*
2. **From the Web Dashboard UI:**
   - Click the **"🛑 Kilépés / Leállítás"** button located in the top-right header of the Web Dashboard. This immediately shuts down the background server and terminates all active worker threads.

---

## 💻 PowerShell CLI Mode (No Browser Required)

If you prefer running directly in your PowerShell terminal without opening a browser:

```powershell
# Interactive menu:
.\burn.ps1
```
Select from:
```
  [1] Open Web Dashboard
  [2] CLI Burn (Continuous)
  [3] CLI Burn with Target Tokens (e.g. 1,000,000)
  [4] CLI Burn with Timed Duration (e.g. 6 hours)
```

### Direct CLI One-Liners:
```powershell
# Burn 500,000 tokens across 16 threads using auto/fast:
.\burn.ps1 -Model "auto/fast" -Concurrency 16 -Mode target -Target 500000

# Continuous burn across 24 threads with 2x prompt multiplier:
.\burn.ps1 -Model "auto/fast" -Concurrency 24 -Multiplier 2.0

# 6-hour timed session rotating between multiple stacks:
.\burn.ps1 -Pool "auto/fast,auto/best-coding" -Concurrency 20 -Mode duration -DurationHours 6
```

---

## ⚙️ Configuration & Environment

The Token Burner automatically detects your local OmniRoute instance (`http://localhost:20128/v1`) and reads your active API key from OpenCode config (`~/.local/share/opencode/auth.json`) if available.

You can override these at any time:
- In the Web UI: Expand the **"OmniRoute Kapcsolat & API Kulcs"** section.
- Via CLI flags: `-ApiKey "your_key"` and `-BaseUrl "http://localhost:20128/v1"`.
- Via Environment Variables:
  ```powershell
  $env:OMNIROUTE_BASE_URL = "http://localhost:20128/v1"
  $env:OMNIROUTE_API_KEY  = "sk-..."
  ```

---

## 📦 Requirements

- **Node.js** (v18.0.0 or newer — built using native `fetch` and ES Modules with zero mandatory external npm packages).
- **OmniRoute** running locally or accessible over network.
- **PowerShell** (5.1 or 7+) or standard Windows Command Prompt.

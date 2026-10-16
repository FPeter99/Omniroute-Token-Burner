# 🔥 OmniRoute Token Burner

High-velocity, parallel AI token incinerator engineered specifically for **OmniRoute** and OpenCode setups.

Burns expiring or excess AI tokens at peak throughput (50,000 – 100,000+ tokens/sec) with zero freezes, clean start/stop controls, and real-time dashboard telemetry.

---

## ⚡ Key Features

- **Prompt Flooding Engine:** Massive, dense synthetic corpus payloads for maximum input ingestion speed.
  - **Monster Size (~65k tok/req):** Highest burn rate.
  - **Large Size (~35k tok/req):** Balanced for large-context models.
  - **Normal Size (~15k tok/req):** Safe for smaller models.
- **Parallel Scaling:** 1 to 64 concurrent threads with quick presets (4, 8, 16, 24, 32, 64).
- **Three Burn Modes:**
  - ♾ **Continuous:** Burns indefinitely until manually stopped.
  - 🎯 **Token Target:** Automatically stops when reaching a specific token count (e.g. 1M, 5M, 10M).
  - ⏱ **Timed Duration:** Runs for a specified period (e.g. 5m, 15m, 30m, 1h, 2h, 6h).
- **Rock-Solid Stability:** Clean, instant aborts (<10ms), zero zombie background threads, auto 429 rate-limit backoff, and protected controls during active sessions.

---

## 🚀 Quick Start

### Web Dashboard (Recommended)

Start the server:
```powershell
.\start.ps1
```
*(or run `start.bat`, or `npm start`)*

Open in browser: **http://localhost:4420**

### Stop Server
```powershell
.\stop.ps1
```
*(or click **Exit** on the Web UI)*

---

## 💻 CLI Mode

Run directly from your terminal:
```powershell
# Interactive menu
.\burn.ps1

# Custom target burn (16 threads, 5M tokens)
.\burn.ps1 -Model "agy/gemini-3.8-flash-high" -Concurrency 16 -Mode target -Target 5000000

# Timed burn (30 minutes)
.\burn.ps1 -Model "agy/gemini-3.8-flash-high" -Concurrency 16 -Mode duration -DurationMinutes 30
```
Or with Node:
```bash
node cli.js --model agy/gemini-3.8-flash-high --concurrency 16 --size monster
```

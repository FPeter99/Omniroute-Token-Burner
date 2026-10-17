# OmniRoute Token Burner

Got too many AI accounts connected to OmniRoute and nothing to do with them? I made this to burn some spare tokens, pretend you're being productive, and flex your token usage to your friends. 😎

![Token Burner dashboard](https://files.catbox.moe/hj4ymi.png)

Local dashboard for controlled AI token-usage sessions through OmniRoute. Select a model or stack, then run continuously, to a token target, or for a set duration.

## Setup

Requires Node.js 20+ and a running OmniRoute server. Set the OmniRoute URL and API key in the dashboard, or use `OMNIROUTE_BASE_URL` and `OMNIROUTE_API_KEY` environment variables. Models load from the connected OmniRoute instance.

## Settings

Choose a model/stack or rotate across a selected pool; set burn mode (continuous, token target, or duration), prompt size, strategy, and concurrency (1–64). Cache-busting and streamed responses can be toggled.

## Start

Run `start.bat`, or in PowerShell:

```powershell
.\start.ps1
```

Open http://localhost:4420. Stop with `Ctrl+C`, `stop.bat`, `.\stop.ps1`, or the dashboard's quit button.

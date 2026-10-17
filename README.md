# OmniRoute Token Burner

![Token Burner dashboard](https://files.catbox.moe/hj4ymi.png)

Local web dashboard for running controlled token-usage sessions through OmniRoute.

## Start

Run `start.bat`, or in PowerShell:

```powershell
.\start.ps1
```

Open http://localhost:4420. Stop with `Ctrl+C`, `stop.bat`, `.\stop.ps1`, or the dashboard's quit button.

Requires Node.js 20+ and a running OmniRoute instance. The dashboard loads available models from OmniRoute; configure the API key in the UI or through `OMNIROUTE_API_KEY`.

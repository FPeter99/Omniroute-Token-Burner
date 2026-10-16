# 🔥 OmniRoute Token Égető

Nagysebességű, stabil és párhuzamosított AI token megsemmisítő kifejezetten **OmniRoute** és OpenCode környezetekhez optimalizálva.

Célja a lejáró vagy felesleges AI tokenek villámgyors és hibamentes elégetése tiszta indítási/leállítási vezérléssel, valós idejű telemetriával és grafikus felülettel.

---

## ⚡ Fő Funkciók & Jellemzők

1. **Maximalizált Égetési Sebesség (Prompt Flooding Technológia):**
   - Előre felépített, sűrű szintetikus elméleti tudásbázis a modell prompt-feldolgozási kapacitásának teljes kihasználásához.
   - **💥 Monster Méret (~65 000 token/kérés):** 8–16 szálon elérhető az **50 000 – 100 000+ token/másodperc** folyamatos sebesség.
   - **⚡ Nagy Méret (~35 000 token/kérés):** Nagyobb kontextusú általános modellekhez.
   - **🏃 Normál Méret (~15 000 token/kérés):** Kisebb kontextusú modellekhez.

2. **Skálázható Párhuzamosság (Akár 64 szál):**
   - Állítható szálszám 1-től 64-ig.
   - Kényelmes gyorsgombok: 4, 8, 16, 24, 32, 64 szál.

3. **3 Égetési Mód:**
   - ♾ **Folyamatos Mód:** Égetés folyamatosan a kézi leállításig.
   - 🎯 **Token Cél:** Automatikus leállás a megadott mennyiség (pl. 1M, 5M, 10M, 20M token) elérésekor.
   - ⏱ **Időzített Mód:** Megadott ideig tartó égetés (pl. 5p, 15p, 30p, 1ó, 2ó, 6ó), pontos hátralévő idő kijelzéssel.

4. **Kőkemény Stabilitás & Zéró Zombi Szál:**
   - Azonnali és tiszta leállítás (`<10 ms`), zéró beragadó worker vagy memóriaszivárgás.
   - Automatikus hiba- és túllépés-védelem (429 Rate Limit automatikus várakozás, 400 Context Limit azonnali leállás).
   - Zárolt vezérlők futás közben a versenyhelyzetek (race condition) megelőzésére.

---

## 🚀 Indítás & Használat

### 1. Webes Irányítópult (Ajánlott)
Indítás PowerShellből:
```powershell
.\start.ps1
```
vagy dupla kattintás a `start.bat` fájlra, vagy:
```bash
npm start
```
A böngésző automatikusan megnyitja: `http://localhost:4420`

### 2. Leállítás
Kattints a felületen a **🛑 LEÁLLÍTÁS** vagy a jobb felső sarokban a **🛑 Kilépés** gombra, vagy terminálból:
```powershell
.\stop.ps1
```

### 3. CLI (Parancssori) Égetés
Interaktív menü vagy közvetlen paraméterezés:
```powershell
# Interaktív menü
.\burn.ps1

# Közvetlen futtatás 16 szálon, 5 millió token céllal
.\burn.ps1 -Model "agy/gemini-3.8-flash-high" -Concurrency 16 -Mode target -Target 5000000

# Időzített futtatás 30 percre
.\burn.ps1 -Model "agy/gemini-3.8-flash-high" -Concurrency 16 -Mode duration -DurationMinutes 30
```
vagy közvetlenül Node-dal:
```bash
node cli.js --model agy/gemini-3.8-flash-high --concurrency 16 --size monster --mode target --target 5000000
```

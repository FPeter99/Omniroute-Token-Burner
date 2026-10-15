# 🔥 OmniRoute Token Burner

Nagysebességű, párhuzamosított AI token égető alkalmazás, kifejezetten az **OmniRoute** routerhez és OpenCode környezethez tervezve.

Ha az OmniRoute-hoz kapcsolt fiókjaidban rengeteg felesleges token van, ezzel az eszközzel a lehető leggyorsabban, teljesen automatizálva égetheted el őket tetszőleges sebességgel és limitekkel.

---

## ⚡ Fő Funkciók

1. **Három rugalmas működési mód:**
   - ♾ **Open / Folyamatos mód:** Addig égeti a tokeneket maximális sebességgel, amíg le nem állítod (vagy Ctrl+C).
   - 🎯 **Token Cél (Target Mode):** Megadható pontos darabszám (pl. `100 000`, `1 000 000`, `10 000 000` token), és amint eléri, azonnal megáll.
   - ⏱ **Időzített (Duration Mode):** Megadható futási időtartam (pl. `30 perc`, `1 óra`, `6 óra`, `12 óra`), a lejáratkor automatikusan lekapcsol.

2. **OmniRoute Stack & Modell kompatibilitás & Turbo Pool:**
   - Teljes kompatibilitás a helyi OmniRoute szerverrel (`http://localhost:20128/v1`).
   - 🔥 **Multi-Stack Turbo Pool (Rotáció):** Egyidejűleg több stack is kijelölhető (pl. `fp99/spam`, `fp99/All-Good`, `fp99/B-tier`, `fp99/cheap-fuse`, `auto/best-coding`). A szálak párhuzamosan szétosztják a kéréseket, így megkerülhető bármely egyedi modell vagy fiók sebességkorlátja!
   - Előre konfigurált **Burn Combók** kiválasztása:
     - `fp99/spam` (Extrém sebességű Round-Robin fallback stack)
     - `fp99/All-Good`
     - `fp99/B-tier`
     - `fp99/S-tier`
     - `fp99/cheap-fuse`
     - `auto/best-coding`, `auto/fast`, stb.
   - 🔄 **Élő modellfrissítés:** Egy kattintással lekéri és listázza a több mint 3000 elérhető modellt közvetlenül az OmniRoute-ból.
   - Tetszőleges egyedi modell/stack név megadása.

3. **Maximalizált égetési stratégiák (Burn Strategies) & Prompt Bomba:**
   - 🚀 **Prompt Flooding (Heavy):** 10.000–80.000+ tokenes masszív technikai és matematikai promptok floodolása minimális kimenettel. Ez a leggyorsabb módja a brutális tokenégetésnek (több százezer vagy millió token/perc).
   - 💣 **Prompt Méret / Multiplier:** 1x (~8k token), 2x (~16k token), 4x (~32k token), 8x (~64k-80k token / kérés)!
   - ⚡ **Hyper-Speed:** Kis prompt (~2 000 token) és villámgyors 1-2 másodperces válaszidő.
   - ⚖️ **Balanced:** Kiegyensúlyozott prompt (~3 000 szó) és 1024 kimeneti token.
   - 📜 **Output Exhaustion:** Hosszú, 4096–8192 tokenes generálásra kényszeríti a modellt.
   - 💥 **Extreme Chaos:** Gigantikus bemenet és maximális kimenet egyidejűleg.

4. **🔥 Cache-Buster védelem:**
   - Minden kérésbe véletlenszerű entropikus nonce-okat és egyedi szekvenciákat ágyaz, megakadályozva, hogy a szolgáltatók az olcsóbb vagy ingyenes "Prompt Cache Read" mechanizmust használják. Így 100%-os fizetős tokenégetést garantál!

5. **Concurrency Tuning (Párhuzamos szálak):**
   - 1-től akár 64 párhuzamos Worker szál.
   - Az OmniRoute automatikusan szétosztja a párhuzamos kéréseket a fiókjaid között.

6. **Valós idejű Cyberpunk Web Dashboard:**
   - Digitális számlálók (Elégetett tokenek, Prompt/Output bontás, Sebesség: Token/sec).
   - Élő sebességgörbe Canvas grafikon.
   - Élő kérésfolyam táblázat részletes válaszidőkkel és előnézettel.
   - 📊 **Riport Export:** Egy kattintásos JSON riport mentés.
   - 🔔 **Hangértesítés:** Lágy dallam szólal meg, ha a cél elérése vagy az időzítő teljesült.

7. **Közvetlen PowerShell CLI mód:**
   - Nem akarsz böngészőt nyitni? Futtasd közvetlenül terminálból a `.\burn.ps1` segítségével!

---

## 🚀 Indítás

### 1. Web Dashboard (Ajánlott)
Kattints duplán a:
```cmd
start.bat
```
vagy PowerShellben:
```powershell
.\start.ps1
```
vagy parancssorból:
```bash
npm start
```
A böngésző automatikusan megnyílik a **`http://localhost:4420`** címen.

---

### 2. PowerShell CLI mód
Indítsd el a mellékelt PowerShell szkriptet:
```powershell
.\burn.ps1
```
Egy kényelmes interaktív menü fogad, ahol kiválaszthatod a módot:
```
  [1] Web Dashboard megnyitása
  [2] CLI égetés (Folyamatos)
  [3] CLI égetés Token Cél alapján (pl. 1 000 000 token)
  [4] CLI égetés Időzített módban (pl. 6 óra)
```

**Közvetlen paraméterezés (egy sorban):**
```powershell
# 500 000 token elégetése 12 szálon az fp99/spam stackkel:
.\burn.ps1 -Model "fp99/spam" -Concurrency 12 -Mode target -Target 500000

# 6 órás égetés 10 szálon:
.\burn.ps1 -Model "fp99/spam" -Concurrency 10 -Mode duration -DurationHours 6
```

---

## ⚙️ Beállítások és API Kulcs

A program automatikusan felismeri az OpenCode-ban használt OmniRoute API kulcsot (`~/.local/share/opencode/auth.json`), így manuális konfiguráció nélkül azonnal működik!

Ha másik kulcsot vagy címet szeretnél használni:
- A Web UI-on nyisd le az **OmniRoute Kapcsolat & API Kulcs** panelt.
- Vagy CLI-ben add meg a `-ApiKey` és `-BaseUrl` kapcsolókat.

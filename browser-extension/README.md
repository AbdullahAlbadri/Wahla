# وهلة — Browser Extension (MVP)

Floating-assistant prototype from the "Wuhla AI Financial Decision Assistant"
design: a small button injected on any page, that sends a purchase's
monthly/installment numbers to the real Wahla decision engine
(`/api/simulate/{account_id}`, same endpoint the mobile app's simulator
uses) and shows the real verdict — no separate "Wuhla Decision Engine" was
built, because one already exists.

## What's real vs. what's a stub

- **Real**: the analysis. Every verdict, health-score delta, and
  cashflow number shown comes from `twin-api` (`api.py` → `twin/engine.py`
  → `twin/simulation.py`), the same engine backing the mobile app.
- **Real**: the privacy model. The content script does nothing until the
  user clicks the floating button, extracts nothing until they click
  "حلّلي هذا القرار", and only ever sends `{monthly, months,
  hasDownPayment, downPayment}` — never the page, never browsing history.
- **Best-effort, not guaranteed**: page-text price/installment extraction
  (`extractPurchaseInfo` in `content.js`) is a regex heuristic over
  `document.body.innerText`. It works on pages that literally print
  "1500 ريال / شهر" or "4 payments" in plain text; it will miss prices
  rendered as images, inside iframes, or phrased unusually. When it can't
  find a confident match, the panel falls back to manual entry instead of
  guessing — this is intentional (see the honesty-over-fabrication
  constraint the rest of this project follows).
- **Stub**: OCR / Vision AI (Feature 1, screenshot share) is NOT built
  here — that's a native mobile OS share-extension (iOS Share Sheet /
  Android Share Target), which needs native code outside what an Expo
  managed app or a browser extension can do. See "Feature 1" notes below
  for what that would actually require.
- **Stub**: account selection. `ACCOUNT_ID = 21` is hardcoded in
  `background.js`, matching the mobile app's fixed demo account — there's
  no login/linking flow in this prototype.

## Load it locally

1. Make sure `twin-api` is running on `http://localhost:8000` (the
   `.claude/launch.json` config in the mobile repo, or
   `python3 -m uvicorn api:app --port 8000 --app-dir /Users/lojain/Wahla`).
2. Chrome/Edge → `chrome://extensions` (or `edge://extensions`) → enable
   **Developer mode** → **Load unpacked** → select this
   `browser-extension/` folder.
3. Visit any page. A small orange "و" button appears bottom-left. Click it,
   enter a monthly amount + number of months (or let it try to
   auto-detect from the page text first), click "حلّلي هذا القرار".
4. Toggle it off any time from the extension's toolbar icon → the switch
   in the popup — `content.js` checks `chrome.storage.sync` on load and
   also reacts live to the toggle via `chrome.storage.onChanged`.

## Architecture (as built)

```
content.js (per-tab, no background scraping)
  → click → extractPurchaseInfo() [best-effort, page text only]
  → user confirms/edits numbers in the panel
  → chrome.runtime.sendMessage({monthly, months, ...})
      ↓
background.js (service worker — the only network egress point)
  → fetch POST http://localhost:8000/api/simulate/21
      ↓
api.py → twin/simulation.py::SimulationEngine._run()
  → real verdict/health-score/cashflow, same logic the mobile
    simulator uses
      ↓
content.js renders the result panel
```

## Feature 1 (screenshot share) — what it would actually take

This can't be a browser extension; it's an OS-level share-sheet
integration:

- **iOS**: a Share Extension target (separate `.appex` bundle) added via
  Xcode/EAS config plugin, using `Vision` framework's
  `VNRecognizeTextRequest` for on-device OCR (no cloud call needed for the
  text extraction step, only for parsing free-form text into
  `{product, price, months, monthly}` if regex isn't enough).
- **Android**: an `Intent.ACTION_SEND` receiver activity, using ML Kit's
  on-device Text Recognition API for the same OCR step.
- Both feed the same extracted `{monthly, months}` shape into
  `/api/simulate/{account_id}` — the decision engine doesn't change at
  all, only how the numbers get to it.
- In a managed Expo app this needs a config plugin + a custom dev client
  (`expo prebuild` / EAS Build) — it cannot run in Expo Go. That's real,
  non-trivial native work, separate from anything in this repo so far.

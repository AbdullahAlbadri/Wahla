# وهلة — Browser Extension (MVP)

Floating-assistant prototype from the "Wuhla AI Financial Decision Assistant"
design: a small button injected on any page, that sends a purchase's
monthly/installment numbers to the real Wahla decision engine
(`/api/simulate/{account_id}`, same endpoint the mobile app's simulator
uses) and shows the real verdict — no separate "Wuhla Decision Engine" was
built, because one already exists.

## What's real vs. what's a stub

- **Real**: the analysis. Every verdict, health-score delta, cashflow
  number, reason, and alternative shown comes from `twin-api`
  (`api.py` → `twin/engine.py`/`twin/simulation.py`/`twin/budget_rule.py`),
  the same engine backing the mobile app. Nothing is computed in the
  extension itself.
- **Real**: the recurring-vs-one-time split. A multi-installment purchase
  (`months > 1`) goes through `/api/simulate` (the recurring-commitment
  simulator, same as the mobile app's محاكي القرارات). A single one-time
  payment (`months == 1`) goes through `/api/decision-check` instead — the
  needs/wants 4-step tree — because treating a one-off purchase as an
  ongoing monthly cost forever would be dishonest, not just a UI choice.
- **Real**: the privacy model. The content script does nothing until the
  user clicks the floating button, extracts nothing until they click
  "حلّلي هذا القرار", and only ever sends `{monthly, months,
  hasDownPayment, downPayment}` — never the page, never browsing history.
- **Real, tested against realistic checkout text**: `extractPurchaseInfo()`
  prioritizes combined "N installments of X" / "X ريال × N دفعات" phrasing
  (the actual Tabby/Tamara widget pattern) over a bare price match, so it
  reads the *per-installment* amount correctly instead of grabbing
  whichever number appears first on the page. Verified against
  `demo-tabby.html` (extracts 187.5 × 4, not the 750 total),
  `demo-onetime.html` (single payment → decision-check path), and
  `demo-wrong-page.html` (no price/payment context → guidance message,
  not a blank form).
- **Real**: BNPL detection (`isBnpl`) is a literal keyword match
  (Tabby/Tamara/تقسيط/أقساط/"pay in N") against the page's own text — shown
  as a badge, never used to fabricate a category the data doesn't support.
- **Real**: wrong-page guidance. If the page has no price/payment
  vocabulary at all, the panel says so explicitly and tells the user to
  open the checkout page — instead of silently showing an empty
  manual-entry form and letting the user guess why.
- **Best-effort, not guaranteed**: extraction is still a regex heuristic
  over `document.body.innerText` — it will miss prices rendered as images,
  inside iframes, or phrased in ways the patterns above don't cover. When
  it can't find a confident match, the panel falls back to manual entry
  rather than guessing.
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
3. Visit any page. A small orange rounded button (wallet + check logo)
   appears bottom-left. Click it, review the extracted (or manually
   entered) numbers, click "حلّلي هذا القرار". On a recurring result, click
   "بدائل مقترحة" for real alternative scenarios.
4. Toggle it off any time from the extension's toolbar icon → the switch
   in the popup — `content.js` checks `chrome.storage.sync` on load and
   also reacts live to the toggle via `chrome.storage.onChanged`.

## Try it without loading an extension

`demo.html`, `demo-tabby.html`, `demo-onetime.html`, and
`demo-wrong-page.html` load the real `content.js`/`content.css` unmodified
(via `chrome-shim.js`, a test-only fake of the two `chrome.*` APIs they
depend on — not part of the shipped bundle) so you can see the exact
shipped behavior by opening these files with any static file server,
no `chrome://extensions` needed.

## Architecture (as built)

```
content.js (per-tab, no background scraping)
  → click → extractPurchaseInfo() [best-effort, page text only]
  → user confirms/edits numbers in the panel
  → chrome.runtime.sendMessage({monthly, months, ...})
      ↓
background.js (service worker — the only network egress point)
  → months > 1: POST /api/simulate/21        (recurring commitment)
  → months == 1: POST /api/decision-check/21 (one-time needs/wants check)
  → "بدائل مقترحة": GET /api/alternatives/21
      ↓
api.py → twin/simulation.py / twin/budget_rule.py
  → real verdict/health-score/cashflow/alternatives, same logic
    the mobile app's simulator and alternatives panel use
      ↓
content.js renders the result panel (verdict, real "why" reasons
from twin_diff, real alternative scenarios)
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

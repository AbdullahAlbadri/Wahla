// Test-only shim — NOT part of the shipped extension bundle (manifest.json
// never references this file). Lets demo-*.html load the real,
// unmodified content.js/content.css and exercise the exact code that
// ships, by faking the two chrome.* APIs it depends on:
// chrome.storage (the enable/disable toggle) and chrome.runtime.sendMessage
// (normally routed through background.js — here it calls the backend
// directly, since a plain page has no service worker to relay through).

window.chrome = window.chrome || {};

chrome.storage = {
  sync: { get: (keys, cb) => cb({ wuhlaEnabled: true }) },
  onChanged: { addListener: () => {} },
};

const WUHLA_SHIM_API_BASE = 'http://localhost:8000';
const WUHLA_SHIM_ACCOUNT_ID = 21;

function wuhlaShimCallApi(path, body) {
  return fetch(`${WUHLA_SHIM_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(res => {
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    return res.json();
  });
}

chrome.runtime = {
  sendMessage: (msg, cb) => {
    if (msg.type === 'ANALYZE_PURCHASE') {
      const { monthly, months, hasDownPayment, downPayment } = msg.payload;
      if (months <= 1) {
        wuhlaShimCallApi(`/api/decision-check/${WUHLA_SHIM_ACCOUNT_ID}`, {
          is_need: false, amount: monthly, can_pay_installments: false,
        })
          .then(data => cb({ ok: true, mode: 'one_off', data }))
          .catch(err => cb({ ok: false, error: err.message }));
      } else {
        wuhlaShimCallApi(`/api/simulate/${WUHLA_SHIM_ACCOUNT_ID}`, {
          type: 'installment', monthly, months,
          hasDownPayment: !!hasDownPayment, down_payment: downPayment || 0,
        })
          .then(data => cb({ ok: true, mode: 'recurring', data }))
          .catch(err => cb({ ok: false, error: err.message }));
      }
    } else if (msg.type === 'FETCH_ALTERNATIVES') {
      const { monthly, months } = msg.payload;
      fetch(`${WUHLA_SHIM_API_BASE}/api/alternatives/${WUHLA_SHIM_ACCOUNT_ID}?monthly=${monthly}&months=${months}`)
        .then(res => {
          if (!res.ok) throw new Error(`API returned ${res.status}`);
          return res.json();
        })
        .then(data => cb({ ok: true, data }))
        .catch(err => cb({ ok: false, error: err.message }));
    }
  },
};

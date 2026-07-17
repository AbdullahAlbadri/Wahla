// Service worker — the only place that talks to the Wahla backend.
// Content scripts never fetch() directly (a page's CSP can block it, and
// this keeps the "what leaves the browser" surface in one auditable file).

const API_BASE = 'http://localhost:8000';
const ACCOUNT_ID = 21; // matches the mobile app's fixed demo account — no login flow in this prototype

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'ANALYZE_PURCHASE') return false;

  const { monthly, months, hasDownPayment, downPayment } = msg.payload;
  fetch(`${API_BASE}/api/simulate/${ACCOUNT_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: months > 1 ? 'installment' : 'subscription',
      monthly,
      months: Math.max(1, months),
      hasDownPayment: !!hasDownPayment,
      down_payment: downPayment || 0,
    }),
  })
    .then(res => {
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      return res.json();
    })
    .then(data => sendResponse({ ok: true, data }))
    .catch(err => sendResponse({ ok: false, error: err.message }));

  return true; // keep the message channel open for the async response
});

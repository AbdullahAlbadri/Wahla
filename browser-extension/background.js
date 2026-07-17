// Service worker — the only place that talks to the Wahla backend.
// Content scripts never fetch() directly (a page's CSP can block it, and
// this keeps the "what leaves the browser" surface in one auditable file).

const API_BASE = 'http://localhost:8000';
const ACCOUNT_ID = 21; // matches the mobile app's fixed demo account — no login flow in this prototype

function callApi(path, body) {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(res => {
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    return res.json();
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ANALYZE_PURCHASE') {
    const { monthly, months, hasDownPayment, downPayment } = msg.payload;

    if (months <= 1) {
      // A single one-time payment isn't a recurring commitment — the
      // 4-step needs/wants decision tree (same one the mobile app's
      // scan.tsx feasibility flow uses) is the honest fit here, not the
      // recurring-subscription simulator. We can't know need-vs-want from
      // page text alone, so this defaults to "want" (the more cautious
      // read) and says so in the UI rather than silently guessing "need".
      callApi(`/api/decision-check/${ACCOUNT_ID}`, {
        is_need: false, amount: monthly, can_pay_installments: false,
      })
        .then(data => sendResponse({ ok: true, mode: 'one_off', data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    } else {
      callApi(`/api/simulate/${ACCOUNT_ID}`, {
        type: 'installment', monthly, months,
        hasDownPayment: !!hasDownPayment, down_payment: downPayment || 0,
      })
        .then(data => sendResponse({ ok: true, mode: 'recurring', data }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
    }
    return true; // keep the message channel open for the async response
  }

  if (msg.type === 'FETCH_ALTERNATIVES') {
    const { monthly, months } = msg.payload;
    fetch(`${API_BASE}/api/alternatives/${ACCOUNT_ID}?monthly=${monthly}&months=${months}`)
      .then(res => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
});

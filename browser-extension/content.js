// Runs on every page (document_idle). Injects a floating button; does
// nothing else until the user clicks it — no background scraping, no
// page content sent anywhere until the user explicitly asks for analysis.

const VERDICT_LABELS = {
  safe: { title: 'القرار آمن', tone: '#3B8C6E' },
  caution: { title: 'القرار يحتاج انتباه', tone: '#C08A2E' },
  risky: { title: 'القرار يحتاج مراجعة', tone: '#C0602E' },
  dangerous: { title: 'القرار غير آمن حاليًا', tone: '#C0392E' },
};

// Best-effort price/installment extraction from visible page text. This is
// a heuristic, not a guarantee — if it can't find a confident match, the
// panel falls back to manual entry rather than pretending it read the page
// correctly. Nothing here is sent anywhere until the user clicks "تحليل".
function extractPurchaseInfo() {
  const text = document.body.innerText || '';

  const priceMatch = text.match(/(?:ريال|SAR|﷼|\$)\s?([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s?(?:ريال|SAR|﷼)/i);
  const price = priceMatch ? parseFloat((priceMatch[1] || priceMatch[2]).replace(/,/g, '')) : null;

  const installmentMatch = text.match(/(\d+)\s?(?:payments|installments?|أشهر|أقساط|دفعات)/i);
  const months = installmentMatch ? parseInt(installmentMatch[1], 10) : null;

  const monthlyMatch = text.match(/([\d,]+(?:\.\d+)?)\s?(?:ريال|SAR|﷼)?\s?\/\s?(?:month|شهر)/i);
  const monthly = monthlyMatch ? parseFloat(monthlyMatch[1].replace(/,/g, '')) : null;

  return { price, months, monthly };
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.id = 'wuhla-panel';
  panel.dir = 'rtl';
  panel.innerHTML = `
    <div class="wuhla-header">
      <span>وهلة</span>
      <button class="wuhla-close" aria-label="إغلاق">×</button>
    </div>
    <div class="wuhla-body"></div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.wuhla-close').addEventListener('click', () => panel.remove());
  return panel;
}

function renderForm(panel, detected) {
  const body = panel.querySelector('.wuhla-body');
  const foundNote = detected.price || detected.monthly
    ? `<p class="wuhla-hint">لقينا أرقام باحتمال أنها مرتبطة بهذا الشراء — تأكدي منها أو عدّليها قبل التحليل.</p>`
    : `<p class="wuhla-hint">ما قدرنا نستخرج الأرقام تلقائيًا من هذي الصفحة — عبّي القيم يدويًا.</p>`;

  body.innerHTML = `
    ${foundNote}
    <label>القسط الشهري (ريال)</label>
    <input type="number" id="wuhla-monthly" value="${detected.monthly || detected.price || ''}" min="0" />
    <label>عدد الأشهر</label>
    <input type="number" id="wuhla-months" value="${detected.months || 1}" min="1" />
    <button id="wuhla-analyze" class="wuhla-primary-btn">حلّلي هذا القرار</button>
  `;

  body.querySelector('#wuhla-analyze').addEventListener('click', () => {
    const monthly = parseFloat(body.querySelector('#wuhla-monthly').value);
    const months = parseInt(body.querySelector('#wuhla-months').value, 10);
    if (!monthly || monthly <= 0) {
      body.querySelector('#wuhla-monthly').focus();
      return;
    }
    renderLoading(panel);
    chrome.runtime.sendMessage(
      { type: 'ANALYZE_PURCHASE', payload: { monthly, months } },
      response => renderResult(panel, response),
    );
  });
}

function renderLoading(panel) {
  panel.querySelector('.wuhla-body').innerHTML = `<p class="wuhla-hint">توأمك الرقمي يحلل الأثر...</p>`;
}

function renderResult(panel, response) {
  const body = panel.querySelector('.wuhla-body');
  if (!response || !response.ok) {
    body.innerHTML = `
      <p class="wuhla-hint">تعذر الاتصال بمحرك التحليل. تأكدي إن تطبيق وهلة شغّال محليًا.</p>
      <button id="wuhla-retry" class="wuhla-primary-btn">حاولي مرة ثانية</button>
    `;
    body.querySelector('#wuhla-retry').addEventListener('click', () => renderForm(panel, extractPurchaseInfo()));
    return;
  }

  const d = response.data;
  const verdict = VERDICT_LABELS[d.verdict] || VERDICT_LABELS.caution;
  const scoreBefore = Math.round(d.before.financial_health_score);
  const scoreAfter = Math.round(d.after.financial_health_score);
  const cashflowAfter = Math.round(d.after.net_cashflow);
  const cashflowLabel = cashflowAfter >= 0 ? 'الفائض الشهري بعد القرار' : 'العجز الشهري بعد القرار';

  body.innerHTML = `
    <div class="wuhla-verdict" style="border-color:${verdict.tone}">
      <strong style="color:${verdict.tone}">${verdict.title}</strong>
      <p>الصحة المالية: ${scoreBefore} → ${scoreAfter}</p>
      <p>${cashflowLabel}: ${cashflowAfter.toLocaleString('en-US')} ريال</p>
    </div>
    <button id="wuhla-again" class="wuhla-secondary-btn">تحليل قرار ثاني</button>
  `;
  body.querySelector('#wuhla-again').addEventListener('click', () => renderForm(panel, extractPurchaseInfo()));
}

function togglePanel() {
  const existing = document.getElementById('wuhla-panel');
  if (existing) {
    existing.remove();
    return;
  }
  const panel = buildPanel();
  renderForm(panel, extractPurchaseInfo());
}

function injectButton() {
  if (document.getElementById('wuhla-fab')) return;
  const btn = document.createElement('button');
  btn.id = 'wuhla-fab';
  btn.setAttribute('aria-label', 'حلّلي هذا الشراء مع وهلة');
  btn.textContent = 'و';
  btn.addEventListener('click', togglePanel);
  document.body.appendChild(btn);
}

chrome.storage.sync.get(['wuhlaEnabled'], ({ wuhlaEnabled }) => {
  // Default ON so the button shows up the first time the extension is
  // installed — the popup lets the user turn it off per their own choice.
  if (wuhlaEnabled !== false) injectButton();
});

chrome.storage.onChanged.addListener(changes => {
  if (!changes.wuhlaEnabled) return;
  const fab = document.getElementById('wuhla-fab');
  const panel = document.getElementById('wuhla-panel');
  if (changes.wuhlaEnabled.newValue === false) {
    fab?.remove();
    panel?.remove();
  } else {
    injectButton();
  }
});

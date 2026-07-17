// Runs on every page (document_idle). Injects a floating button; does
// nothing else until the user clicks it — no background scraping, no
// page content sent anywhere until the user explicitly asks for analysis.

const WUHLA_LOGO_SVG = `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4 7.5C4 6.11929 5.11929 5 6.5 5H17.5C18.8807 5 20 6.11929 20 7.5V16.5C20 17.8807 18.8807 19 17.5 19H6.5C5.11929 19 4 17.8807 4 16.5V7.5Z" stroke="white" stroke-width="1.6"/>
  <path d="M4 9.5H20" stroke="white" stroke-width="1.6"/>
  <path d="M15 14.2L17 16.2L20.5 12" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const VERDICT_LABELS = {
  safe: { title: 'القرار آمن', tone: '#3B8C6E' },
  caution: { title: 'القرار يحتاج انتباه', tone: '#C08A2E' },
  risky: { title: 'القرار يحتاج مراجعة', tone: '#C0602E' },
  dangerous: { title: 'القرار غير آمن حاليًا', tone: '#C0392E' },
};

const REASON_LABELS = {
  'monthly obligations increased': 'ارتفاع الالتزامات الشهرية',
  'recurring spending increased': 'زيادة المصروفات المتكررة',
  'savings rate fell': 'انخفاض معدل الادخار',
  'debt ratio increased': 'ارتفاع نسبة الالتزامات للدخل',
  'liquidity buffer shrank': 'تقلص هامش السيولة',
  'overall health deteriorated': 'تراجع الصحة المالية',
  'savings rate improved': 'تحسن معدل الادخار',
  'liquidity buffer grew': 'نمو هامش السيولة',
  'overall health improved': 'تحسن الصحة المالية',
};

const ALT_LABELS = {
  reduce_payment: 'قسط أقل',
  longer_duration: 'مدة أطول',
  invest_instead: 'استثمار المبلغ بدل الالتزام',
  use_liquidity: 'استخدام السيولة المتاحة',
  restructure_debt: 'إعادة هيكلة التزام قائم',
};

// Real-world checkout pages say "pay in", "installments", "Tabby",
// "Tamara", "قسّط", etc. — matched literally from page text, not inferred.
const BNPL_HINT = /tabby|tamara|قسّط|تقسيط|أقساط|installments?|pay in \d/i;

// A page only counts as a checkout/payment page if it has both a price-like
// number AND payment-related vocabulary — a price alone appears on plenty
// of non-checkout pages (product listings, blog posts, etc.).
const PAYMENT_CONTEXT = /دفع|checkout|إتمام الطلب|إجمالي|total|سلة|cart|pay now|purchase|اشتري/i;

function extractPurchaseInfo() {
  const text = document.body.innerText || '';
  const num = s => parseFloat(s.replace(/,/g, ''));

  // Priority 1: "N installments/payments of X" or "X ريال × N دفعات" — the
  // real Tabby/Tamara/BNPL widget phrasing, where the count and the
  // per-installment amount are stated together. Reading them as one match
  // avoids the ambiguity of a page having BOTH a total price and a
  // per-installment price as separate numbers.
  const countThenAmount =
    text.match(/(\d+)\s?(?:installments?|payments)\s+of\s+([\d,]+(?:\.\d+)?)/i) ||
    text.match(/(\d+)\s?(?:دفعات|أقساط)[^\d]{0,20}?([\d,]+(?:\.\d+)?)\s?(?:ريال|SAR|﷼)/i);
  const amountThenCount =
    !countThenAmount &&
    text.match(/([\d,]+(?:\.\d+)?)\s?(?:ريال|SAR|﷼)?\s?[×x]\s?(\d+)\s?(?:دفعات|أقساط|payments)/i);

  if (countThenAmount) {
    return {
      price: null, months: parseInt(countThenAmount[1], 10), monthly: num(countThenAmount[2]),
      isBnpl: BNPL_HINT.test(text), looksLikePaymentPage: PAYMENT_CONTEXT.test(text),
    };
  }
  if (amountThenCount) {
    return {
      price: null, months: parseInt(amountThenCount[2], 10), monthly: num(amountThenCount[1]),
      isBnpl: BNPL_HINT.test(text), looksLikePaymentPage: PAYMENT_CONTEXT.test(text),
    };
  }

  // Priority 2: an explicit "X/month" marker — a real recurring amount,
  // distinct from the total price that's usually also on the page.
  const monthlyMatch = text.match(/([\d,]+(?:\.\d+)?)\s?(?:ريال|SAR|﷼)?\s?\/\s?(?:month|شهر)/i);
  const monthly = monthlyMatch ? num(monthlyMatch[1]) : null;

  const installmentMatch = text.match(/(\d+)\s?(?:payments|installments?|أشهر|أقساط|دفعات)/i);
  const months = installmentMatch ? parseInt(installmentMatch[1], 10) : null;

  // Priority 3 (fallback): the first plain price on the page — read as a
  // one-time total, not a monthly amount, since there was no installment
  // phrasing to say otherwise.
  const priceMatch = text.match(/(?:ريال|SAR|﷼|\$)\s?([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s?(?:ريال|SAR|﷼)/i);
  const price = priceMatch ? num(priceMatch[1] || priceMatch[2]) : null;

  const isBnpl = BNPL_HINT.test(text);
  const looksLikePaymentPage = (price !== null || monthly !== null) && PAYMENT_CONTEXT.test(text);

  return { price, months, monthly, isBnpl, looksLikePaymentPage };
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.id = 'wuhla-panel';
  panel.dir = 'rtl';
  panel.innerHTML = `
    <div class="wuhla-header">
      <div class="wuhla-brand"><span class="wuhla-logo">${WUHLA_LOGO_SVG}</span><span>وهلة</span></div>
      <button class="wuhla-close" aria-label="إغلاق">×</button>
    </div>
    <div class="wuhla-body"></div>
  `;
  document.body.appendChild(panel);
  panel.querySelector('.wuhla-close').addEventListener('click', () => panel.remove());
  return panel;
}

function renderWrongPage(panel) {
  const body = panel.querySelector('.wuhla-body');
  body.innerHTML = `
    <div class="wuhla-empty">
      <p class="wuhla-empty-title">هذي مو صفحة دفع على ما يبدو</p>
      <p class="wuhla-hint">ما لقينا سعر أو خطة دفع واضحة بهذي الصفحة. افتحي صفحة الدفع/إتمام الطلب (Checkout) بعد ما تضيفين المنتج للسلة، وجربي مرة ثانية من هناك.</p>
      <button id="wuhla-manual-anyway" class="wuhla-secondary-btn">أدخلي القيم يدويًا مع ذلك</button>
    </div>
  `;
  body.querySelector('#wuhla-manual-anyway').addEventListener('click', () => renderForm(panel, extractPurchaseInfo(), true));
}

function renderForm(panel, detected, forceManual) {
  if (!forceManual && !detected.looksLikePaymentPage) {
    renderWrongPage(panel);
    return;
  }

  const body = panel.querySelector('.wuhla-body');
  const foundNote = detected.price || detected.monthly
    ? `<p class="wuhla-hint">لقينا أرقام باحتمال أنها مرتبطة بهذا الشراء — تأكدي منها أو عدّليها قبل التحليل.</p>`
    : `<p class="wuhla-hint">ما قدرنا نستخرج الأرقام تلقائيًا من هذي الصفحة — عبّي القيم يدويًا.</p>`;
  const bnplNote = detected.isBnpl
    ? `<div class="wuhla-badge">لاحظنا خطة دفع آجل (تقسيط) بهذي الصفحة</div>`
    : '';

  body.innerHTML = `
    ${bnplNote}
    ${foundNote}
    <label>${detected.months && detected.months > 1 ? 'قيمة القسط الشهري (ريال)' : 'المبلغ (ريال)'}</label>
    <input type="number" id="wuhla-monthly" value="${detected.monthly || detected.price || ''}" min="0" />
    <label>عدد الدفعات (1 = دفعة واحدة كاملة)</label>
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
      response => renderResult(panel, response, monthly, months),
    );
  });
}

function renderLoading(panel) {
  panel.querySelector('.wuhla-body').innerHTML = `<p class="wuhla-hint">توأمك الرقمي يحلل الأثر...</p>`;
}

function renderResult(panel, response, monthly, months) {
  const body = panel.querySelector('.wuhla-body');
  if (!response || !response.ok) {
    body.innerHTML = `
      <p class="wuhla-hint">تعذر الاتصال بمحرك التحليل. تأكدي إن تطبيق وهلة شغّال محليًا.</p>
      <button id="wuhla-retry" class="wuhla-primary-btn">حاولي مرة ثانية</button>
    `;
    body.querySelector('#wuhla-retry').addEventListener('click', () => renderForm(panel, extractPurchaseInfo()));
    return;
  }

  if (response.mode === 'one_off') {
    renderOneOffResult(panel, response.data, monthly);
    return;
  }
  renderRecurringResult(panel, response.data, monthly, months);
}

function renderOneOffResult(panel, d, amount) {
  const body = panel.querySelector('.wuhla-body');
  const tone = d.allow ? '#3B8C6E' : '#C0392E';
  const title = d.allow ? 'مقبول ضمن وضعك الحالي' : 'غير مناسب حاليًا';

  body.innerHTML = `
    <div class="wuhla-verdict" style="border-color:${tone}">
      <strong style="color:${tone}">${title}</strong>
      <p>${amount.toLocaleString('en-US')} ريال — دفعة واحدة</p>
      <p class="wuhla-reason">${d.reason}</p>
    </div>
    <p class="wuhla-hint wuhla-fine-print">افترضنا إنها "رغبة" وليست "احتياج أساسي" لأننا ما نقدر نحدد نوع المنتج من الصفحة — لو كانت احتياج فعلي (طبي، سكن...) النتيجة غالبًا بتكون أفضل.</p>
    <button id="wuhla-again" class="wuhla-secondary-btn">تحليل قرار ثاني</button>
  `;
  body.querySelector('#wuhla-again').addEventListener('click', () => renderForm(panel, extractPurchaseInfo()));
}

function renderRecurringResult(panel, d, monthly, months) {
  const body = panel.querySelector('.wuhla-body');
  const verdict = VERDICT_LABELS[d.verdict] || VERDICT_LABELS.caution;
  const scoreBefore = Math.round(d.before.financial_health_score);
  const scoreAfter = Math.round(d.after.financial_health_score);
  const cashflowAfter = Math.round(d.after.net_cashflow);
  const cashflowLabel = cashflowAfter >= 0 ? 'الفائض الشهري بعد القرار' : 'العجز الشهري بعد القرار';

  const scoreEntry = (d.twin_diff || []).find(e => e.attribute === 'financial_health_score');
  const reasons = (scoreEntry?.reasons || []).map(r => REASON_LABELS[r] || r);

  body.innerHTML = `
    <div class="wuhla-verdict" style="border-color:${verdict.tone}">
      <strong style="color:${verdict.tone}">${verdict.title}</strong>
      <p>الصحة المالية: ${scoreBefore} → ${scoreAfter}</p>
      <p>${cashflowLabel}: ${cashflowAfter.toLocaleString('en-US')} ريال</p>
    </div>
    ${reasons.length ? `
      <div class="wuhla-reasons">
        <p class="wuhla-section-label">ليش؟</p>
        ${reasons.map(r => `<div class="wuhla-reason-row"><span class="wuhla-dot"></span>${r}</div>`).join('')}
      </div>
    ` : ''}
    <button id="wuhla-show-alts" class="wuhla-secondary-btn">بدائل مقترحة</button>
    <div id="wuhla-alts-slot"></div>
    <button id="wuhla-again" class="wuhla-secondary-btn">تحليل قرار ثاني</button>
  `;

  body.querySelector('#wuhla-again').addEventListener('click', () => renderForm(panel, extractPurchaseInfo()));
  body.querySelector('#wuhla-show-alts').addEventListener('click', e => {
    e.target.disabled = true;
    e.target.textContent = 'جاري التحميل...';
    chrome.runtime.sendMessage(
      { type: 'FETCH_ALTERNATIVES', payload: { monthly, months } },
      response => renderAlternatives(panel, response),
    );
  });
}

function renderAlternatives(panel, response) {
  const btn = panel.querySelector('#wuhla-show-alts');
  const slot = panel.querySelector('#wuhla-alts-slot');
  if (btn) btn.remove();

  if (!response || !response.ok) {
    slot.innerHTML = `<p class="wuhla-hint">تعذر تحميل البدائل.</p>`;
    return;
  }

  const d = response.data;
  const cards = [];
  if (d.longer_duration) {
    cards.push({
      label: ALT_LABELS.longer_duration,
      detail: `${d.longer_duration.months} شهر بدل الحالي — قسط ${Math.round(d.longer_duration.monthly).toLocaleString('en-US')} ريال`,
      best: d.best_scenario === 'تمديد المدة',
    });
  }
  if (d.reduce_payment) {
    cards.push({
      label: ALT_LABELS.reduce_payment,
      detail: `قسط مقترح ${Math.round(d.reduce_payment.suggested_monthly).toLocaleString('en-US')} ريال شهريًا`,
      best: false,
    });
  }
  if (d.invest_instead) {
    cards.push({
      label: ALT_LABELS.invest_instead,
      detail: `نفس المبلغ كاستثمار: +${Math.round(d.invest_instead.projected_gain).toLocaleString('en-US')} ريال متوقعة بدل الالتزام`,
      best: false,
    });
  }

  if (!cards.length) {
    slot.innerHTML = `<p class="wuhla-hint">ما فيه بدائل واضحة أفضل من القرار الحالي لهذا الحساب.</p>`;
    return;
  }

  slot.innerHTML = cards.map(c => `
    <div class="wuhla-alt-card ${c.best ? 'wuhla-alt-best' : ''}">
      ${c.best ? '<span class="wuhla-alt-tag">الأفضل</span>' : ''}
      <strong>${c.label}</strong>
      <p>${c.detail}</p>
    </div>
  `).join('');
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
  btn.innerHTML = WUHLA_LOGO_SVG;
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

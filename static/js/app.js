/* ══════════════════════════════════════════════════════
   app.js — API config, state, home page / generate,
            render result, refine, feedback, history,
            tools, analytics, policies, sidebar stats
══════════════════════════════════════════════════════ */


/* ══════════════════════════════════════
   API ENDPOINTS
══════════════════════════════════════ */
const API = {
  run:            '/api/run',
  clarify:        '/api/clarify',
  clarifyMerge:   '/api/clarify-merge',
  refine:         '/api/refine',
  feedback:       '/api/feedback',
  audit:          '/api/audit',
  analytics:      '/api/analytics',
  tools:          '/api/tools',
  policies:       '/api/policies',
  uploadPolicy:   '/api/upload-policy',
  deletePolicy:   (f) => `/api/policies/${encodeURIComponent(f)}`,
  promptVersions: '/api/prompt-versions',
};


/* ══════════════════════════════════════
   STATE
══════════════════════════════════════ */
let currentAuditId     = null;
let currentOutput      = '';   // latest llm output — updated on each refinement too
let currentInput       = '';   // original user question
let currentCorlo       = '';   // CORLO prompt that generated the response
let currentRole        = 'general';
let currentTaskType    = 'general';
let currentIntent      = 'general';
let currentIndustry    = 'general';
let currentTool        = '';


/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initSidebar();
  initHomePage();
  initComboboxHighlight();
  initOutputTabs();
  initFeedback();
  initModal();
  initPoliciesPage();
  loadSidebarStats();
  // Toolbar hidden until a prompt is generated
  const t = document.getElementById('promptToolbar');
  if (t) t.style.display = 'none';

  // Init hamburger drawer AFTER everything else so the
  // button clone strips the sidebar-open listener added by initSidebar
  initHamburgerDrawer();
});




/* ══════════════════════════════════════
   HOME PAGE — Prompt Builder
══════════════════════════════════════ */
function initHomePage() {
  const textarea  = document.getElementById('userInput');
  const charCount = document.getElementById('charCount');

  textarea.addEventListener('input', () => { charCount.textContent = textarea.value.length; });

  document.querySelectorAll('.chip[data-example]').forEach(chip => {
    chip.addEventListener('click', () => {
      textarea.value = chip.dataset.example;
      charCount.textContent = textarea.value.length;
      textarea.focus();
    });
  });

  document.getElementById('btnGenerate').addEventListener('click', handleGenerate);
  document.getElementById('btnNewPrompt').addEventListener('click', resetToStep1);

  document.getElementById('btnCopyOutput').addEventListener('click', () => {
    const panel = document.querySelector('.output-panel.active .output-content');
    if (panel) _copyToClipboard(panel.textContent, () => showToast('Copied!', 'success'));
  });

  document.getElementById('btnRefine')?.addEventListener('click', handleRefine);

  // ── Edit / Copy / Save prompt toolbar ──
  document.getElementById('btnEditPrompt')?.addEventListener('click', enterPromptEditMode);
  document.getElementById('btnCopyPrompt')?.addEventListener('click', copyPromptText);
  document.getElementById('btnSavePrompt')?.addEventListener('click', savePromptToFavorites);
  document.getElementById('btnPromptOk')?.addEventListener('click', applyPromptEdit);
  document.getElementById('btnPromptCancelEdit')?.addEventListener('click', cancelPromptEdit);
}


/* ══════════════════════════════════════
   PROMPT TOOLBAR — Edit / Copy / Save
══════════════════════════════════════ */

function enterPromptEditMode() {
  const display  = document.getElementById('resultPrompt');
  const textarea = document.getElementById('promptEditArea');
  const okBar    = document.getElementById('promptEditOk');
  const editBtn  = document.getElementById('btnEditPrompt');

  textarea.value        = display.textContent;
  display.style.display = 'none';
  textarea.style.display = 'block';
  okBar.style.display   = 'flex';
  editBtn.textContent   = '✎ Editing…';
  editBtn.disabled      = true;
  textarea.focus();
}

function applyPromptEdit() {
  const display  = document.getElementById('resultPrompt');
  const textarea = document.getElementById('promptEditArea');
  const okBar    = document.getElementById('promptEditOk');
  const editBtn  = document.getElementById('btnEditPrompt');

  display.textContent    = textarea.value;
  currentCorlo           = textarea.value;   // keep state in sync
  display.style.display  = 'block';
  textarea.style.display = 'none';
  okBar.style.display    = 'none';
  editBtn.textContent    = '✎ Edit';
  editBtn.disabled       = false;

  // Show revised banner
  const banner = document.getElementById('revisedBanner');
  if (banner) {
    banner.textContent   = '✅ Prompt updated manually.';
    banner.style.display = 'block';
  }
  showToast('Prompt updated!', 'success');
}

function cancelPromptEdit() {
  const display  = document.getElementById('resultPrompt');
  const textarea = document.getElementById('promptEditArea');
  const okBar    = document.getElementById('promptEditOk');
  const editBtn  = document.getElementById('btnEditPrompt');

  display.style.display  = 'block';
  textarea.style.display = 'none';
  okBar.style.display    = 'none';
  editBtn.textContent    = '✎ Edit';
  editBtn.disabled       = false;
}

/* ══════════════════════════════════════
   HTTP-SAFE CLIPBOARD HELPERS
   navigator.clipboard requires HTTPS — execCommand fallback for http://localhost
══════════════════════════════════════ */
function _copyToClipboard(text, onSuccess) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(onSuccess)
      .catch(() => _execCommandCopy(text, onSuccess));
  } else {
    _execCommandCopy(text, onSuccess);
  }
}

function _execCommandCopy(text, onSuccess) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    if (onSuccess) onSuccess();
  } catch(e) {
    showToast('Copy failed — please select and copy manually.', 'error');
  }
  document.body.removeChild(ta);
}

function copyPromptText() {
  const text = document.getElementById('resultPrompt').textContent;
  if (!text || text.startsWith('(')) { showToast('No prompt to copy yet.', 'error'); return; }
  _copyToClipboard(text, () => {
    const btn = document.getElementById('btnCopyPrompt');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1800);
    showToast('Prompt copied!', 'success');
  });
}

function savePromptToFavorites() {
  const text = document.getElementById('resultPrompt').textContent;
  if (!text || text.startsWith('(')) { showToast('No prompt to save yet.', 'error'); return; }

  // Build a title from the user input (first 50 chars)
  const title = (currentInput || 'Saved Prompt').substring(0, 50).trim()
              + (currentInput && currentInput.length > 50 ? '…' : '');

  // Read existing favorites from localStorage (same key as promptlib.js)
  let favs = [];
  try { favs = JSON.parse(localStorage.getItem('pl_favorites') || '[]'); } catch {}

  // Avoid exact duplicates by title
  if (favs.some(f => f.title === title)) {
    showToast('Already saved in Favorites.', 'info'); return;
  }

  favs.push({ title, body: currentInput, fromHome: true });
  localStorage.setItem('pl_favorites', JSON.stringify(favs));

  // Visual feedback
  const confirm = document.getElementById('saveConfirm');
  if (confirm) { confirm.style.display = 'inline'; setTimeout(() => { confirm.style.display = 'none'; }, 2500); }
  showToast('Saved to Favorites in Scenario Library!', 'success');
}


/* ══════════════════════════════════════
   COMBOBOX CUSTOM VALUE HIGHLIGHT
   — marks the input when user types a value not in the datalist
══════════════════════════════════════ */
function initComboboxHighlight() {
  const ROLE_OPTIONS = [
    'consultant / manager','executive / director','developer / technical',
    'business analyst','sales / bd','marketing / comms','hr / people ops','finance / accounting'
  ];
  const TASK_OPTIONS = [
    'research & analysis','writing & docs','strategy & planning','data analysis',
    'code & dev','creative content','communication','learning & training',
    'process automation','decision support'
  ];

  function bindComboHighlight(inputId, knownValues) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = el.value.trim().toLowerCase();
      if (!v) { el.classList.remove('custom-value'); return; }
      // Case-insensitive match — preset values chosen from the datalist won't be flagged
      const isKnown = knownValues.some(opt => opt.toLowerCase() === v);
      el.classList.toggle('custom-value', !isKnown);
    });
    // Also fire once on blur so pasted values are caught
    el.addEventListener('blur', () => el.dispatchEvent(new Event('input')));
  }

  bindComboHighlight('selRole',     ROLE_OPTIONS);
  bindComboHighlight('selTaskType', TASK_OPTIONS);
}

/* ══════════════════════════════════════
   CLARIFICATION MODAL STATE
══════════════════════════════════════ */
let _clarQuestions     = [];
let _clarInput         = '';
let _clarRole          = 'general';
let _clarTaskType      = 'general';
let _clarEnrichedInput = '';   // filled after /api/clarify-merge

function _openClarModal(questions, input, role, taskType) {
  _clarQuestions     = questions;
  _clarInput         = input;
  _clarRole          = role;
  _clarTaskType      = taskType;
  _clarEnrichedInput = '';

  const body = document.getElementById('clarBody');
  body.innerHTML = questions.map((q, i) => `
    <div class="clar-question-block" id="clar-qblock-${i}">
      <label class="clar-question-label" for="clar-ans-${i}">
        <span class="clar-q-num">${i + 1}</span>${escapeHtml(q)}
      </label>
      <input
        class="clar-answer-input"
        id="clar-ans-${i}"
        type="text"
        placeholder="Your answer… (leave blank to skip)"
        autocomplete="off"
        maxlength="120"
      />
    </div>
  `).join('');

  document.getElementById('clarOverlay').classList.add('open');

  const first = document.getElementById('clar-ans-0');
  if (first) setTimeout(() => first.focus(), 80);

  document.getElementById('clarSubmitBtn').onclick  = _handleClarSubmit;
  document.getElementById('clarSkipBtn').onclick    = _handleClarSkip;
  document.getElementById('clarSkipBtn2').onclick   = _handleClarSkip;

  document.getElementById('clarOverlay').onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _handleClarSubmit(); }
    if (e.key === 'Escape') _handleClarSkip();
  };
}

function _closeClarModal() {
  document.getElementById('clarOverlay').classList.remove('open');
}

async function _handleClarSubmit() {
  const answers = _clarQuestions.map((_, i) =>
    (document.getElementById(`clar-ans-${i}`)?.value || '').trim()
  );

  _closeClarModal();

  const hasAnyAnswer = answers.some(a => a.length > 0);
  if (!hasAnyAnswer) {
    _runGenerate(_clarInput, _clarRole, _clarTaskType);
    return;
  }

  try {
    const mergeRes = await fetch(API.clarifyMerge, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        user_input: _clarInput,
        role:       _clarRole,
        task_type:  _clarTaskType,
        questions:  _clarQuestions,
        answers:    answers,
      }),
    });
    const mergeData = await mergeRes.json();
    _clarEnrichedInput = (mergeData.enriched_input || _clarInput).trim();
  } catch {
    _clarEnrichedInput = _clarInput;
  }

  _showEnrichedSuggestion(_clarEnrichedInput, _clarRole, _clarTaskType);
}

function _handleClarSkip() {
  _closeClarModal();
}

/* ── Enriched suggestion modal shown after clarification answers ── */
function _showEnrichedSuggestion(enriched, role, taskType) {
  const overlay   = document.getElementById('enrichedOverlay');
  const textarea  = document.getElementById('userInput');
  const charCount = document.getElementById('charCount');
  const descDisplay = document.getElementById('enrichedDescDisplay');
  const descTextarea = document.getElementById('enrichedDescText');
  const editBtn   = document.getElementById('enrichedEditBtn');

  descDisplay.textContent = enriched;
  descDisplay.style.display = '';
  descTextarea.value = enriched;
  descTextarea.style.display = 'none';
  editBtn.innerHTML = '&#9998; Edit';

  document.getElementById('enrichedOrigText').textContent = _clarInput;

  editBtn.onclick = () => {
    const isEditing = descTextarea.style.display !== 'none';
    if (isEditing) {
      const updated = descTextarea.value.trim() || enriched;
      descDisplay.textContent = updated;
      descDisplay.style.display = '';
      descTextarea.style.display = 'none';
      editBtn.innerHTML = '&#9998; Edit';
    } else {
      descTextarea.value = descDisplay.textContent;
      descDisplay.style.display = 'none';
      descTextarea.style.display = '';
      descTextarea.focus();
      editBtn.innerHTML = '&#10003; Done';
    }
  };

  overlay.classList.add('open');

  document.getElementById('enrichedBannerUse').onclick = () => {
    const finalText = (descTextarea.style.display !== 'none'
      ? descTextarea.value
      : descDisplay.textContent
    ).trim() || enriched;
    overlay.classList.remove('open');
    textarea.value = finalText;
    if (charCount) charCount.textContent = finalText.length;
    _runGenerate(finalText, role, taskType);
  };

  document.getElementById('enrichedBannerOriginal').onclick = () => {
    overlay.classList.remove('open');
    _runGenerate(_clarInput, role, taskType);
  };

  document.getElementById('enrichedBannerClose').onclick = () => {
    overlay.classList.remove('open');
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  };
}

async function handleGenerate() {
  const input    = document.getElementById('userInput').value.trim();
  const role     = (document.getElementById('selRole')?.value     || '').trim() || 'general';
  const taskType = (document.getElementById('selTaskType')?.value || '').trim() || 'general';

  if (!input) { showToast('Please describe your task first.', 'error'); return; }

  const existingBanner = document.getElementById('enrichedSuggestionBanner');
  if (existingBanner) existingBanner.remove();

  const btnGenerate = document.getElementById('btnGenerate');
  btnGenerate.disabled = true;
  btnGenerate.textContent = 'Checking…';

  const _resetBtn = () => {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Response`;
  };

  let needsClar = false;
  try {
    const clarRes = await fetch(API.clarify, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_input: input, role, task_type: taskType }),
    });

    if (clarRes.ok) {
      const clarData = await clarRes.json();
      if (clarData.needs_clarification && clarData.questions && clarData.questions.length > 0) {
        needsClar = true;
        _resetBtn();
        _openClarModal(clarData.questions, input, role, taskType);
      }
    }
  } catch {
    /* network error — skip clarification and generate directly */
  }

  if (needsClar) return;

  _resetBtn();
  await _runGenerate(input, role, taskType);
}

async function _runGenerate(input, role, taskType) {
  goToStep(2);
  startProcessingAnimation();

  try {
    const res = await fetch(API.run, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        user_input:       input,
        role:             role,
        task_type:        taskType,
        data_sensitivity: 'general',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();

    currentAuditId  = data.audit_id;
    currentOutput   = data.output           || '';
    currentCorlo    = data.corlo_prompt     || '';
    currentInput    = input;
    currentRole     = role;
    currentTaskType = taskType;
    currentIntent   = data.intent           || 'general';
    currentIndustry = data.industry         || 'general';
    currentTool     = data.recommended_tool || '';

    await finishProcessingAnimation();
    renderResult(data);
    goToStep(3);
    loadSidebarStats();

  } catch (err) {
    goToStep(1);
    showToast(`Error: ${err.message}`, 'error');
  }
}

function resetToStep1() {
  goToStep(1);
  document.getElementById('userInput').value       = '';
  document.getElementById('charCount').textContent = '0';
  const roleEl = document.getElementById('selRole');
  const taskEl = document.getElementById('selTaskType');
  if (roleEl) { roleEl.value = ''; roleEl.classList.remove('custom-value'); }
  if (taskEl) { taskEl.value = ''; taskEl.classList.remove('custom-value'); }
  const banner = document.getElementById('revisedBanner');
  if (banner) { banner.style.display = 'none'; banner.textContent = ''; }
  const ri = document.getElementById('refinementInput');
  if (ri) ri.value = '';
  const toolbar = document.getElementById('promptToolbar');
  if (toolbar) toolbar.style.display = 'none';
  document.getElementById('enrichedOverlay')?.classList.remove('open');
  _closeClarModal();
  cancelPromptEdit();
  currentAuditId     = null;
  currentOutput      = '';
  currentCorlo       = '';
  currentInput       = '';
  currentRole        = 'general';
  currentTaskType    = 'general';
  currentIntent      = 'general';
  currentIndustry    = 'general';
  currentTool        = '';
  document.querySelectorAll('.star').forEach(s => s.classList.remove('lit'));
}


/* ══════════════════════════════════════
   PROMPT BADGE HELPER
   Reads is_prompt_required from registry raw_data and returns a badge span.
   Values: "yes"/"required"/"true"/"1" → Required
           "no"/"not required"/"false"/"0" → No Prompt
           "optional" → Optional
══════════════════════════════════════ */
function buildPromptBadge(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const val = String(raw).trim().toLowerCase();
  if (val === 'yes' || val === 'true' || val === '1' || val === 'required')
    return `<span class="tool-badge-prompt-req">✍️ Prompt Required</span>`;
  if (val === 'no' || val === 'false' || val === '0' || val === 'not required')
    return `<span class="tool-badge-prompt-no">⚡ No Prompt</span>`;
  if (val === 'optional')
    return `<span class="tool-badge-prompt-opt">💡 Prompt Optional</span>`;
  return '';
}


/* ══════════════════════════════════════
   RENDER RESULT
══════════════════════════════════════ */
function renderResult(data) {
  // ── Meta badges ──
  const confClass   = data.tool_confidence === 'high'   ? 'conf-high'
                    : data.tool_confidence === 'medium' ? 'conf-med' : 'conf-low';
  const role        = data.role      || '';
  const taskType    = data.task_type || '';

  document.getElementById('resultMeta').innerHTML = `
    ${data.recommended_tool ? `<span class="meta-badge tool">${escapeHtml(data.tool_icon || '🤖')} ${escapeHtml(data.recommended_tool)}</span>` : ''}
    ${data.intent    ? `<span class="meta-badge intent">Intent: ${capitalize(data.intent)}</span>` : ''}
    ${data.industry  ? `<span class="meta-badge intent">Industry: ${capitalize(data.industry)}</span>` : ''}
    ${data.tool_confidence ? `<span class="meta-badge ${confClass}">${capitalize(data.tool_confidence)} confidence</span>` : ''}
    ${role     ? `<span class="meta-badge role">👤 ${capitalize(role)}</span>`     : ''}
    ${taskType ? `<span class="meta-badge role">📌 ${capitalize(taskType)}</span>` : ''}
  `;

  // ── Policy blocked banner — shown prominently above everything if blocked ──
  const blockedBox = document.getElementById('policyBlockedBox');
  if (data.policy_blocked) {
    blockedBox.style.display = 'block';
    blockedBox.innerHTML = `
      <div class="safety-banner bad" style="margin-bottom:12px">
        <span>🚫</span>
        <div>
          <strong>Task blocked by company policy</strong>
          <span>${escapeHtml(data.policy_summary || 'This request conflicts with one or more company policies.')}</span>
        </div>
      </div>`;
  } else {
    blockedBox.style.display = 'none';
    blockedBox.innerHTML = '';
  }

  // ── Tool recommendation box ──
  const toolBox = document.getElementById('toolRecBox');
  if (data.recommended_tool && !data.policy_blocked) {
    toolBox.innerHTML = `
      <div class="tool-rec-box">
        <div class="tool-rec-header">
          <div class="tool-rec-icon">${escapeHtml(data.tool_icon || '🤖')}</div>
          <div>
            <div class="tool-rec-name">${escapeHtml(data.recommended_tool)}</div>
            <div class="tool-rec-category">${escapeHtml(data.tool_category || '')}</div>
          </div>
          <div class="tool-rec-badges" id="toolRecBadges"></div>
        </div>
        <div class="tool-rec-reason">${escapeHtml(data.tool_reason || '')}</div>

        ${(typeof data.tool_confidence_pct === 'number' && data.tool_confidence_pct > 0) ? (() => {
          const confPct    = data.tool_confidence_pct;
          const confExpl   = data.tool_confidence_explanation || '';
          const confLabel  = confPct >= 85 ? 'Excellent fit' : confPct >= 75 ? 'Strong fit' : confPct >= 55 ? 'Good fit' : confPct >= 35 ? 'Partial fit' : 'Weak fit';
          const confColor  = confPct >= 85 ? '#10B981' : confPct >= 75 ? '#00A3E0' : confPct >= 55 ? '#3B82F6' : confPct >= 35 ? '#F59E0B' : '#EF4444';
          const confBg     = confPct >= 85 ? '#ECFDF5' : confPct >= 75 ? '#E8F7FD' : confPct >= 55 ? '#EFF6FF' : confPct >= 35 ? '#FFFBEB' : '#FEF2F2';
          const confBorder = confPct >= 85 ? '#6EE7B7' : confPct >= 75 ? '#BAE6FD' : confPct >= 55 ? '#BFDBFE' : confPct >= 35 ? '#FCD34D' : '#FCA5A5';
          return `
        <div style="margin-top:14px;padding:14px 16px;border-radius:10px;background:${confBg};border:1px solid ${confBorder};">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:${confColor};">Match Confidence</span>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;font-weight:800;color:${confColor};">${confPct}%</span>
              <span style="font-size:11px;font-weight:600;color:${confColor};padding:2px 8px;border-radius:999px;background:${confBorder};opacity:0.85">${confLabel}</span>
            </div>
          </div>
          <div style="height:8px;background:rgba(0,0,0,0.07);border-radius:999px;overflow:hidden;${confExpl ? 'margin-bottom:10px' : ''}">
            <div style="height:100%;width:${confPct}%;background:${confColor};border-radius:999px;transition:width 0.6s ease;"></div>
          </div>
          ${confExpl ? `<div style="font-size:12px;color:${confColor};line-height:1.6;opacity:0.9;">${escapeHtml(confExpl)}</div>` : ''}
        </div>`;
        })() : ''}

        <div class="tool-rec-footer" style="margin-top:12px;">
          ${data.tool_url ? `<a class="tool-url-btn" href="${escapeHtml(data.tool_url)}" target="_blank" rel="noopener">🚀 Open Tool</a>` : ''}
        </div>
      </div>`;

    // Async: inject prompt-required badge once registry is available
    fetch(API.tools).then(r => r.json()).then(registry => {
      const key  = Object.keys(registry).find(k => k.toLowerCase() === (data.recommended_tool || '').toLowerCase());
      const info = key ? registry[key] : null;
      const badgesEl = document.getElementById('toolRecBadges');
      if (badgesEl && info) {
        const rawPrompt = (info.raw_data?.is_prompt_required ?? info.is_prompt_required ?? '');
        const promptBadge = buildPromptBadge(rawPrompt);
        if (promptBadge) badgesEl.insertAdjacentHTML('afterbegin', promptBadge);
      }
    }).catch(() => {});
  } else {
    toolBox.innerHTML = '';
  }

  // ── Policy flags ──
  const flagsBox = document.getElementById('policyFlagsBox');
  const flags    = data.policy_flags || [];
  if (flags.length) {
    flagsBox.innerHTML = `
      <div class="policy-flag-list">
        ${flags.map(f => `<div class="policy-flag">⚠ ${escapeHtml(f)}</div>`).join('')}
      </div>`;
  } else {
    flagsBox.innerHTML = '';
  }

  const altBox        = document.getElementById('alternativesBox');
  const CONF_THRESHOLD = 60;
  const _altsRaw      = (data.tool_alternatives || []);
  const _altReasons   = data.tool_alternative_reasons || [];
  const _altConfPcts  = data.tool_alternative_confidence_pcts || [];

  // Keep only alternatives at or above the confidence threshold
  const filteredIdxs  = _altsRaw
    .map((a, i) => i)
    .filter(i => _altsRaw[i] && _altsRaw[i].trim() && (typeof _altConfPcts[i] === 'number' ? _altConfPcts[i] >= CONF_THRESHOLD : true));

  const alts        = filteredIdxs.map(i => _altsRaw[i]);
  const altReasons  = filteredIdxs.map(i => _altReasons[i] || '');
  const altConfPcts = filteredIdxs.map(i => _altConfPcts[i]);

  const ALT_VISIBLE = 2;

  if (alts.length > 0 && !data.policy_blocked) {
    // Skeleton cards — enriched async from registry below
    altBox.innerHTML = `
      <div class="alt-section-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Also Consider
      </div>
      <div class="alt-cards-row" id="altCardsRow">
        ${alts.map((a, i) => `
          <div class="alt-card${i >= ALT_VISIBLE ? ' alt-card-hidden' : ''}" id="alt-card-${CSS.escape(a)}">
            <div class="alt-card-icon">🤖</div>
            <div class="alt-card-body">
              <div class="alt-card-name">${escapeHtml(a)}</div>
              <div class="alt-card-cat">Loading…</div>
            </div>
            <div class="alt-card-right">
              <span class="alt-conf-pct" id="alt-conf-${CSS.escape(a)}"></span>
              <button class="alt-card-btn" onclick="openAlternativeTool('${escapeHtml(a)}')" title="Open ${escapeHtml(a)}">
                ↗ Open
              </button>
            </div>
          </div>`).join('')}
      </div>
      ${alts.length > ALT_VISIBLE ? `
      <button class="alt-see-more-btn" id="altSeeMoreBtn" onclick="(function(){
        var hidden = document.querySelectorAll('#altCardsRow .alt-card-hidden');
        var btn = document.getElementById('altSeeMoreBtn');
        if(hidden.length){
          hidden.forEach(function(c){ c.classList.remove('alt-card-hidden'); });
          btn.textContent = 'See less ▲';
        } else {
          var all = document.querySelectorAll('#altCardsRow .alt-card');
          all.forEach(function(c,i){ if(i >= ${ALT_VISIBLE}) c.classList.add('alt-card-hidden'); });
          btn.textContent = 'See more (${alts.length - ALT_VISIBLE} more) ▼';
        }
      })()">See more (${alts.length - ALT_VISIBLE} more) ▼</button>` : ''}`;

    // Enrich cards asynchronously — fills icon, category, badge, full description, reason, confidence %
    fetch(API.tools).then(r => r.json()).then(registry => {
      alts.forEach((a, i) => {
        const key  = Object.keys(registry).find(k => k.toLowerCase() === a.toLowerCase());
        const info = key ? registry[key] : null;
        const card = document.getElementById(`alt-card-${CSS.escape(a)}`);
        if (!card) return;

        // Confidence % badge next to Open button
        const confEl  = document.getElementById(`alt-conf-${CSS.escape(a)}`);
        const pctVal  = typeof altConfPcts[i] === 'number' ? altConfPcts[i] : null;
        if (confEl && pctVal !== null) {
          const altColor = pctVal >= 75 ? '#10B981' : pctVal >= 55 ? '#00A3E0' : '#F59E0B';
          confEl.textContent   = pctVal + '%';
          confEl.style.color   = altColor;
          confEl.style.fontWeight = '700';
          confEl.style.fontSize   = '13px';
        }

        if (info) {
          card.querySelector('.alt-card-icon').textContent = info.icon || '🤖';
          card.querySelector('.alt-card-cat').textContent  = info.category || '';

          // Prompt-required badge — injected into alt-card-right, above the % and Open button
          const rawPrompt = (info.raw_data?.is_prompt_required ?? info.is_prompt_required ?? '');
          const promptBadge = buildPromptBadge(rawPrompt);
          if (promptBadge) {
            const altRight = card.querySelector('.alt-card-right');
            if (altRight && !altRight.querySelector('.alt-prompt-badge')) {
              altRight.insertAdjacentHTML('afterbegin', promptBadge.replace('class="', 'class="alt-prompt-badge '));
            }
          }

          // Full description — no truncation
          if (info.description) {
            const descEl = document.createElement('div');
            descEl.className   = 'alt-card-desc';
            descEl.textContent = info.description;
            card.querySelector('.alt-card-body').appendChild(descEl);
          }

          // Reason sentence from LLM (italic, below description)
          const reason = altReasons[i] || '';
          if (reason) {
            const reasonEl = document.createElement('div');
            reasonEl.className   = 'alt-card-reason';
            reasonEl.textContent = reason;
            card.querySelector('.alt-card-body').appendChild(reasonEl);
          }

          if (info.url) {
            card.querySelector('.alt-card-btn').onclick = () =>
              window.open(info.url, '_blank', 'noopener');
          }
        } else {
          card.querySelector('.alt-card-cat').textContent = 'AI Tool';
        }
      });
    }).catch(() => {});
  } else {
    altBox.innerHTML = '';
  }


  // ── Confidentiality Notice (only when NOT blocked) ──
  const confNoticeBox = document.getElementById('confidentialityNotice');
  if (confNoticeBox) {
    if (!data.policy_blocked) {
      confNoticeBox.style.display = 'flex';
    } else {
      confNoticeBox.style.display = 'none';
    }
  }

  // ── Output panels ──
  document.getElementById('resultPrompt').textContent = data.policy_blocked
    ? '(Prompt not generated — task was blocked by company policy.)'
    : (data.corlo_prompt || '(No prompt generated)');

// Policies Applied tab — rich HTML for both blocked and allowed cases
  const policySummary = data.policy_summary || '';
  const policyFlags   = data.policy_flags   || [];
  const policiesEl    = document.getElementById('resultPolicies');

  if (data.policy_blocked) {
    // ── BLOCKED: show a clear violation breakdown ──
    const flagItems = policyFlags.length
      ? policyFlags.map(f => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
               background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;margin-bottom:8px;">
            <span style="font-size:16px;flex-shrink:0;">🚫</span>
            <span style="font-size:13px;color:#991B1B;font-weight:600;">${escapeHtml(f)}</span>
          </div>`).join('')
      : `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
              background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;margin-bottom:8px;">
           <span style="font-size:16px;flex-shrink:0;">🚫</span>
           <span style="font-size:13px;color:#991B1B;font-weight:600;">Prohibited content detected</span>
         </div>`;

    policiesEl.innerHTML = `
      <div style="padding:4px 2px;">

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">🛡️</span>
          <div>
            <div style="font-size:14px;font-weight:800;color:#991B1B;">Request Blocked by Company Policy</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;">This task cannot proceed — one or more policy violations were detected.</div>
          </div>
        </div>

        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;
             color:var(--text3);margin-bottom:8px;">Policy Violations Detected</div>
        ${flagItems}

        <div style="margin-top:16px;padding:12px 14px;background:#FFF7ED;border:1px solid #FCD34D;
             border-radius:8px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;
               color:#92400E;margin-bottom:6px;">📋 Policy Explanation</div>
          <div style="font-size:13px;color:#78350F;line-height:1.6;">
            ${escapeHtml(policySummary || 'This request conflicts with your company\'s acceptable use policy. Prohibited topics include harmful content, dangerous instructions, and restricted subject matter.')}
          </div>
        </div>

        <div style="margin-top:14px;padding:12px 14px;background:#F0F9FF;border:1px solid #BAE6FD;
             border-radius:8px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;
               color:#075985;margin-bottom:6px;">💡 What you can do instead</div>
          <div style="font-size:13px;color:#0C4A6E;line-height:1.6;">
            Please rephrase your request to focus on a permitted topic. If you believe this was flagged in error, contact your policy administrator. You can also try a different task type or industry context.
          </div>
        </div>

      </div>`;

  } else {
    // ── ALLOWED: show a green clearance summary ──
    const flagItems = policyFlags.length
      ? `<div style="margin-bottom:14px;">
           <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;
                color:var(--text3);margin-bottom:8px;">⚠️ Soft Warnings (non-blocking)</div>
           ${policyFlags.map(f => `
             <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;
                  background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;margin-bottom:6px;">
               <span style="font-size:14px;flex-shrink:0;">⚠️</span>
               <span style="font-size:12px;color:#92400E;">${escapeHtml(f)}</span>
             </div>`).join('')}
         </div>`
      : '';

    policiesEl.innerHTML = `
      <div style="padding:4px 2px;">

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:20px;">✅</span>
          <div>
            <div style="font-size:14px;font-weight:800;color:#065F46;">Request Cleared — Safe to Proceed</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px;">No prohibited content was detected. Your request is within policy guidelines.</div>
          </div>
        </div>

        <div style="padding:12px 14px;background:#ECFDF5;border:1px solid #6EE7B7;
             border-radius:8px;margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;
               color:#065F46;margin-bottom:6px;">📋 Policy Assessment</div>
          <div style="font-size:13px;color:#064E3B;line-height:1.6;">
            ${escapeHtml(policySummary || 'This request was reviewed against applicable company policies and no violations were found. You may proceed using the generated CORLO prompt.')}
          </div>
        </div>

        ${flagItems}

        <div style="padding:12px 14px;background:var(--bg-secondary);border:1px solid var(--border);
             border-radius:8px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;
               color:var(--text3);margin-bottom:8px;">🔒 Enterprise Policy Reminders</div>
          <div style="display:flex;flex-direction:column;gap:7px;">
            <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text2);">
              <span style="color:var(--success);font-weight:700;flex-shrink:0;">✓</span>
              Use only approved AI tools listed in your organisation's registry.
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text2);">
              <span style="color:var(--success);font-weight:700;flex-shrink:0;">✓</span>
              Do not include credentials, passwords, or confidential client data in prompts.
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text2);">
              <span style="color:var(--success);font-weight:700;flex-shrink:0;">✓</span>
              Review all AI-generated output before sharing externally.
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text2);">
              <span style="color:var(--success);font-weight:700;flex-shrink:0;">✓</span>
              Sensitive data classifications must follow your data governance framework.
            </div>
          </div>
        </div>

      </div>`;
  }

  // ── Show/hide revised prompt box based on whether task is blocked ──
  const refinementBox = document.getElementById('refinementBox');
  if (refinementBox) {
    refinementBox.style.display = data.policy_blocked ? 'none' : '';
  }

  // Show/hide Edit-Copy-Save toolbar
  const promptToolbar = document.getElementById('promptToolbar');
  if (promptToolbar) {
    promptToolbar.style.display = data.policy_blocked ? 'none' : 'flex';
  }
  // Reset edit mode if re-generating
  cancelPromptEdit();

  // Reset revised banner
  const revisedBanner = document.getElementById('revisedBanner');
  if (revisedBanner) {
    revisedBanner.style.display = 'none';
    revisedBanner.textContent   = '';
  }
  const refinementInput = document.getElementById('refinementInput');
  if (refinementInput) refinementInput.value = '';

  // Reset active tab to CORLO Prompt (first tab)
  document.querySelectorAll('.output-tab').forEach((t, i)  => t.classList.toggle('active', i === 0));
  document.querySelectorAll('.output-panel').forEach((p, i) => p.classList.toggle('active', i === 0));
}


/* ══════════════════════════════════════
   REFINEMENT — user adds a comment to revise the CORLO prompt
   The LLM rewrites the prompt based on the user's feedback.
══════════════════════════════════════ */
async function handleRefine() {
  const comment = document.getElementById('refinementInput').value.trim();
  if (!comment)        { showToast('Please enter a comment first.', 'error'); return; }
  if (!currentAuditId) { showToast('No result to refine yet.', 'error');     return; }

  const spinner = document.getElementById('refineSpinner');
  const btn     = document.getElementById('btnRefine');
  btn.disabled  = true;
  if (spinner) spinner.style.display = 'inline';

  try {
    const res = await fetch(API.refine, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        audit_id:         currentAuditId,
        user_input:       currentInput,
        corlo_prompt:     currentCorlo,
        llm_output:       currentOutput,
        comment:          comment,
        role:             currentRole,
        task_type:        currentTaskType,
        data_sensitivity: 'general',
        intent:           currentIntent,
        industry:         currentIndustry,
        recommended_tool: currentTool,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();

    // Update tracked corlo so a second refinement builds on this version
    currentCorlo  = data.revised_output;
    currentOutput = data.revised_output;

    // Show the revised prompt in the CORLO Prompt panel
    const promptPanel = document.getElementById('resultPrompt');
    if (promptPanel) promptPanel.textContent = data.revised_output;

    // Show revised banner
    const banner = document.getElementById('revisedBanner');
    if (banner) {
      banner.textContent     = '✅ CORLO Prompt revised based on your feedback.';
      banner.style.display   = 'block';
    }

    // Switch to CORLO Prompt tab to show the revision
    document.querySelectorAll('.output-tab').forEach((t, i)  => t.classList.toggle('active', i === 0));
    document.querySelectorAll('.output-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

    document.getElementById('refinementInput').value = '';
    showToast('CORLO Prompt revised successfully!', 'success');

  } catch (err) {
    showToast(`Refinement failed: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    if (spinner) spinner.style.display = 'none';
  }
}


/* ══════════════════════════════════════
   FEEDBACK
══════════════════════════════════════ */
function initFeedback() {
  const stars = document.querySelectorAll('.star');
  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const r = parseInt(star.dataset.rating);
      stars.forEach(s => s.classList.toggle('lit', parseInt(s.dataset.rating) <= r));
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('lit'));
    });
    star.addEventListener('click', () => submitFeedback(parseInt(star.dataset.rating)));
  });
}

async function submitFeedback(rating) {
  if (!currentAuditId) return;
  try {
    await fetch(API.feedback, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ audit_id: currentAuditId, rating, comment: '', issue_type: '', source: 'rl' }),
    });
    showToast(`Thanks for rating! (${rating}★)`, 'success');
    document.querySelectorAll('.star').forEach((s, i) => s.classList.toggle('lit', i < rating));
  } catch {
    showToast('Failed to submit feedback.', 'error');
  }
}




/* ══════════════════════════════════════
   HISTORY
══════════════════════════════════════ */
async function loadHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const res  = await fetch(`${API.audit}?limit=30`);
    const data = await res.json();

    if (!data.length) {
      list.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <p>No history yet. Generate your first prompt!</p>
        </div>`;
      return;
    }

    list.innerHTML = data.map(row => `
      <div class="history-item">
        <div class="history-item-icon">🤖</div>
        <div class="history-item-body">
          <div class="history-item-input" title="${escapeHtml(row.raw_input || '')}">${escapeHtml(row.raw_input || '—')}</div>
          <div class="history-item-meta">
            <span>🎯 ${capitalize(row.intent || '—')}</span>
            <span>🏭 ${capitalize(row.industry || '—')}</span>
            <span>🔧 ${escapeHtml(row.recommended_tool || '—')}</span>
            <span>🕐 ${formatDate(row.created_at)}</span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="openLogModal('${row.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            View
          </button>

          <button
            class="btn btn-primary btn-sm"
            onclick="openHistoryRegenerateModal('${encodeURIComponent(row.raw_input || '')}')"
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            Regenerate
        </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p>Failed to load history: ${err.message}</p></div>`;
  }
}

document.getElementById('btnRefreshHistory')?.addEventListener('click', loadHistory);


/* ══════════════════════════════════════
   AI TOOLS PAGE
══════════════════════════════════════ */
/* ── Tool role mapping ── */
const TOOL_ROLE_MAP = {
  sales:      ['axet.gaia','cassidy','chatgpt','microsoft copilot','loopio','hubspot','partner copilot','clay','sales research assistant'],
  consulting: ['genai amplifier (poc)','sales research assistant','sherlock ai','strategic insights ai','axet.gaia','axet.wise','axet.talk','cassidy','chatgpt','microsoft copilot','synthesia'],
  hr:         ['hr chatbot','axet.gaia','chatgpt','microsoft copilot','synthesia'],
  finance:    ['icertis','axet.gaia','axet.wise','chatgpt','microsoft copilot'],
  marketing:  ['axet.gaia','chatgpt','microsoft copilot','hubspot','jasper','synthesia'],
  ams:        ['ams process assistant','ai ticket bot','strategic insights ai','axet.talk','genai amplifier (poc)','axet.gaia','cassidy','chatgpt','microsoft copilot'],
  developer:  ['axet.gaia','axet.plugin','axet.oasis','axet.flows','chatgpt','microsoft copilot'],
  operations: ['cassidy','axet.flows','axet.gaia','chatgpt','microsoft copilot','synthesia'],
};

let _toolsData    = null;
let _toolsView    = 'tile';
let _toolsTab     = 'all';
let _toolsSearch  = '';

async function loadTools() {
  const grid = document.getElementById('toolsGrid');
  if (!_toolsData) {
    grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    try {
      const res   = await fetch(API.tools);
      _toolsData  = await res.json();
    } catch (err) {
      grid.innerHTML = `<div class="empty-state"><p>Failed to load tools: ${err.message}</p></div>`;
      return;
    }
  }

  /* tab filter */
  let entries = Object.entries(_toolsData);
  if (_toolsTab !== 'all') {
    const allowed = TOOL_ROLE_MAP[_toolsTab] || [];
    entries = entries.filter(([name]) => allowed.includes(name.toLowerCase()));
  }

  /* search filter */
  if (_toolsSearch.trim()) {
    const q = _toolsSearch.toLowerCase();
    entries = entries.filter(([name, info]) =>
      name.toLowerCase().includes(q) ||
      (info.desc_content || info.description || '').toLowerCase().includes(q) ||
      (info.category || '').toLowerCase().includes(q)
    );
  }

  if (!entries.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text3);">No tools found</div>`;
    return;
  }

  grid.innerHTML = entries.map(([name, info]) => `
    <div class="tool-card" data-tool-name="${escapeHtml(name.toLowerCase())}">
      <div class="tool-card-header">
        <div class="tool-icon">${info.icon || '🤖'}</div>
        <div>
          <div class="tool-name">${escapeHtml(name)}</div>
          <div class="tool-category">${escapeHtml(info.category)}</div>
        </div>
      </div>
      <p class="tool-desc">${escapeHtml(info.desc_content || info.description)}</p>
      <a href="${escapeHtml(info.url)}" target="_blank" rel="noopener" class="tool-link">Visit →</a>
    </div>
  `).join('');
}

function initToolsPage() {
  /* tab clicks */
  document.getElementById('toolRoleTabs')?.querySelectorAll('.pl-role-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#toolRoleTabs .pl-role-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _toolsTab = tab.dataset.role;
      loadTools();
    });
  });

  /* search */
  const searchEl = document.getElementById('toolsSearch');
  let searchTimer;
  searchEl?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { _toolsSearch = searchEl.value; loadTools(); }, 250);
  });

  /* view toggle */
  document.getElementById('btnTileView')?.addEventListener('click', () => {
    _toolsView = 'tile';
    document.getElementById('toolsGrid')?.classList.remove('row-view');
    document.getElementById('btnTileView')?.classList.add('active');
    document.getElementById('btnRowView')?.classList.remove('active');
  });
  document.getElementById('btnRowView')?.addEventListener('click', () => {
    _toolsView = 'row';
    document.getElementById('toolsGrid')?.classList.add('row-view');
    document.getElementById('btnRowView')?.classList.add('active');
    document.getElementById('btnTileView')?.classList.remove('active');
  });
}


/* ══════════════════════════════════════
   OPEN ALTERNATIVE TOOL — looks up URL from registry or navigates to tools page
══════════════════════════════════════ */
async function openAlternativeTool(toolName) {
  try {
    const res  = await fetch(API.tools);
    const data = await res.json();
    // Case-insensitive lookup
    const key  = Object.keys(data).find(k => k.toLowerCase() === toolName.toLowerCase());
    if (key && data[key] && data[key].url) {
      window.open(data[key].url, '_blank', 'noopener');
    } else {
      // Fallback: navigate to AI Tools page so user can find it
      showToast(`Opening AI Tools page — search for "${toolName}"`, 'success');
      if (typeof navigateTo === 'function') navigateTo('tools');
      document.querySelectorAll('.nav-tab').forEach(n =>
        n.classList.toggle('active', n.dataset.page === 'tools'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-tools')?.classList.add('active');
      loadTools();
    }
  } catch {
    showToast(`Could not open "${toolName}". Please check AI Tools page.`, 'error');
  }
}


/* ══════════════════════════════════════
   ANALYTICS PAGE
══════════════════════════════════════ */
async function loadAnalytics() {
  const container = document.getElementById('analyticsContent');
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  try {
    const res  = await fetch(API.analytics);
    const data = await res.json();
    const maxIntent = Math.max(...(data.intents || []).map(r => r.c), 1);
    const maxTool   = Math.max(...(data.tools   || []).map(r => r.c), 1);

    container.innerHTML = `
      <div class="analytics-stats">
        <div class="stat-card"><div class="stat-card-label">Total Runs</div><div class="stat-card-val accent">${data.total_runs ?? 0}</div></div>
        <div class="stat-card"><div class="stat-card-label">Avg Rating</div><div class="stat-card-val accent">${data.avg_rating ?? '—'}</div></div>
        <div class="stat-card"><div class="stat-card-label">Feedback Count</div><div class="stat-card-val">${data.feedback_count ?? 0}</div></div>
        <div class="stat-card"><div class="stat-card-label">Industries</div><div class="stat-card-val">${(data.industries || []).length}</div></div>
      </div>
      <div class="analytics-grid">
        <div class="analytics-card">
          <div class="analytics-card-title">Intent Breakdown</div>
          ${(data.intents || []).map(r => `
            <div class="bar-row">
              <div class="bar-label" title="${r.intent}">${capitalize(r.intent)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round(r.c/maxIntent*100)}%"></div></div>
              <div class="bar-count">${r.c}</div>
            </div>`).join('') || '<p style="color:var(--text3);font-size:13px">No data yet.</p>'}
        </div>
        <div class="analytics-card">
          <div class="analytics-card-title">Tool Usage</div>
          ${(data.tools || []).map(r => `
            <div class="bar-row">
              <div class="bar-label" title="${r.recommended_tool}">${escapeHtml(r.recommended_tool)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round(r.c/maxTool*100)}%;background:var(--success)"></div></div>
              <div class="bar-count">${r.c}</div>
            </div>`).join('') || '<p style="color:var(--text3);font-size:13px">No data yet.</p>'}
        </div>
        <div class="analytics-card">
          <div class="analytics-card-title">Top Industries</div>
          ${(data.industries || []).map(r => `
            <div class="bar-row">
              <div class="bar-label">${capitalize(r.industry)}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${Math.round(r.c/maxIntent*100)}%;background:#8B5CF6"></div></div>
              <div class="bar-count">${r.c}</div>
            </div>`).join('') || '<p style="color:var(--text3);font-size:13px">No data yet.</p>'}
        </div>
        <div class="analytics-card">
          <div class="analytics-card-title">Feedback Issues</div>
          ${(data.issue_types || []).length
            ? (data.issue_types || []).map(r => `
              <div class="bar-row">
                <div class="bar-label">${escapeHtml(r.issue_type || 'Other')}</div>
                <div class="bar-track"><div class="bar-fill" style="background:var(--danger)"></div></div>
                <div class="bar-count">${r.c}</div>
              </div>`).join('')
            : '<p style="color:var(--text3);font-size:13px">No issues reported yet.</p>'}
        </div>
      </div>`;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Failed: ${err.message}</p></div>`;
  }
}

document.getElementById('btnRefreshAnalytics')?.addEventListener('click', loadAnalytics);


/* ══════════════════════════════════════
   POLICIES PAGE
══════════════════════════════════════ */
function initPoliciesPage() {
  const zone      = document.getElementById('uploadZone');
  const fileInput = document.getElementById('policyFileInput');
  const btnBrowse = document.getElementById('btnBrowseFile');

  btnBrowse.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadPolicyFile(fileInput.files[0]);
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) uploadPolicyFile(e.dataTransfer.files[0]);
  });

  document.getElementById('btnRefreshPolicies')?.addEventListener('click', loadPolicies);
}

async function uploadPolicyFile(file) {
  const status = document.getElementById('uploadStatus');
  status.innerHTML = `<div style="color:var(--text2);display:flex;align-items:center;gap:8px">
    <div class="spinner" style="width:16px;height:16px;border-width:2px"></div>
    Uploading ${escapeHtml(file.name)}…
  </div>`;

  const form = new FormData();
  form.append('file', file);
  try {
    const res  = await fetch(API.uploadPolicy, { method: 'POST', body: form });
    const data = await res.json();
    if (data.status === 'ok') {
      status.innerHTML = `<span style="color:var(--success)">✅ Indexed ${data.chunks_indexed} chunks from <strong>${escapeHtml(data.filename)}</strong></span>`;
      loadPolicies();
      showToast('Policy uploaded!', 'success');
    } else { throw new Error(data.detail || 'Upload failed'); }
  } catch (err) {
    status.innerHTML = `<span style="color:var(--danger)">❌ ${err.message}</span>`;
    showToast(`Upload failed: ${err.message}`, 'error');
  }
}

async function loadPolicies() {
  const list = document.getElementById('policiesList');
  list.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  try {
    const res  = await fetch(API.policies);
    const data = await res.json();
    if (!data.sources || !data.sources.length) {
      list.innerHTML = '<p style="padding:16px;color:var(--text3);font-size:13px">No policies indexed yet.</p>';
      updateStat('sbPolicies', 0);
      return;
    }
    updateStat('sbPolicies', data.sources.length);
    list.innerHTML = data.sources.map(src => `
      <div class="policy-item">
        <div class="policy-name">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"
            style="display:inline;vertical-align:middle;color:var(--text3)">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          ${escapeHtml(src)}
        </div>
        <button class="btn-danger" onclick="deletePolicy('${escapeHtml(src)}')">Delete</button>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<p style="padding:16px;color:var(--danger);font-size:13px">Error: ${err.message}</p>`;
  }
}

async function deletePolicy(filename) {
  if (!confirm(`Delete policy "${filename}"?`)) return;
  try {
    await fetch(API.deletePolicy(filename), { method: 'DELETE' });
    showToast('Policy deleted.', 'success');
    loadPolicies();
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}


/* ══════════════════════════════════════
   SIDEBAR STATS
══════════════════════════════════════ */
async function loadSidebarStats() {
  try {
    const [ar, pr]   = await Promise.all([fetch(API.analytics), fetch(API.policies)]);
    const analytics  = await ar.json();
    const policies   = await pr.json();
    updateStat('sbTotalRuns', analytics.total_runs ?? 0);
    updateStat('sbAvgRating', analytics.avg_rating ? `${analytics.avg_rating}★` : '—');
    updateStat('sbPolicies',  (policies.sources || []).length);
  } catch {}
}


function openHistoryRegenerateModal(encodedInput) {
  const body = decodeURIComponent(encodedInput || '');

  // move to Home first
  if (typeof navigateTo === 'function') navigateTo('home');

  // switch visible nav/page state
  document.querySelectorAll('.nav-tab').forEach(n =>
    n.classList.toggle('active', n.dataset.page === 'home'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-home')?.classList.add('active');

  // open same popup used by Scenario Library Generate button
  if (typeof plOpenScenarioGenModal === 'function') {
    plOpenScenarioGenModal({ body });
  } else {
    // fallback: just populate textarea if modal function is not available
    const textarea  = document.getElementById('userInput');
    const charCount = document.getElementById('charCount');
    if (textarea) {
      textarea.value = body;
      if (charCount) charCount.textContent = body.length;
      textarea.dispatchEvent(new Event('input'));
    }
  }
}
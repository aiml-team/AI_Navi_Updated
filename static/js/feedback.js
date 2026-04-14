/* ══════════════════════════════════════════════════════════════════
   feedback.js — Feedback Form Modal + Feedback Viewer Modal
══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ═══════════════════════════════════════
     FEEDBACK FORM MODAL
  ═══════════════════════════════════════ */
  const ISSUE_TYPES = [
    'Wrong Tool', 'Poor Output', 'Missing Feature',
    'Slow Response', 'UI Issue', 'Other'
  ];

  const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  let formOverlay, formModal, formBody, formSuccess;
  let selectedRating  = 0;
  let selectedIssue   = '';
  let currentAuditId  = '';

  function initForm() {
    formOverlay = document.getElementById('fbOverlay');
    formModal   = document.getElementById('fbFormModal');
    formBody    = document.getElementById('fbFormBody');
    formSuccess = document.getElementById('fbFormSuccess');

    if (!formModal) return;

    document.getElementById('fbCloseBtn')?.addEventListener('click', closeForm);
    document.getElementById('fbCancelBtn')?.addEventListener('click', closeForm);
    formOverlay?.addEventListener('click', closeForm);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && formModal.classList.contains('open')) closeForm();
    });

    buildFormBody();
  }

  function buildFormBody() {
    if (!formBody) return;
    formBody.innerHTML = `
      <div class="fb-field">
        <label>Email Address</label>
        <input type="email" id="fbEmail" placeholder="you@company.com" autocomplete="email"/>
      </div>

      <div class="fb-field">
        <label>Rating <span style="color:#ef4444">*</span></label>
        <div class="fb-stars-row" id="fbStarsRow">
          ${[1,2,3,4,5].map(n => `<span class="fb-star" data-val="${n}" role="button" aria-label="${n} star">★</span>`).join('')}
          <span class="fb-star-label" id="fbStarLabel">Select a rating</span>
        </div>
      </div>

      <div class="fb-field">
        <label>Issue Type</label>
        <div class="fb-issue-pills" id="fbIssuePills">
          ${ISSUE_TYPES.map(t => `<button class="fb-pill" data-issue="${t}">${t}</button>`).join('')}
        </div>
      </div>

      <div class="fb-field">
        <label>Comments</label>
        <textarea id="fbComment" placeholder="Tell us what you think — any detail helps…" maxlength="1000"></textarea>
      </div>

      <div class="fb-submit-row">
        <button class="fb-btn-cancel" id="fbCancelBtn2">Cancel</button>
        <button class="fb-btn-submit" id="fbSubmitBtn" disabled>Submit Feedback</button>
      </div>
    `;

    selectedRating = 0;
    selectedIssue  = '';

    /* Stars */
    const stars = formBody.querySelectorAll('.fb-star');
    const label = formBody.querySelector('#fbStarLabel');
    stars.forEach(star => {
      star.addEventListener('mouseenter', () => highlightStars(stars, +star.dataset.val));
      star.addEventListener('mouseleave', () => highlightStars(stars, selectedRating));
      star.addEventListener('click', () => {
        selectedRating = +star.dataset.val;
        highlightStars(stars, selectedRating);
        label.textContent = STAR_LABELS[selectedRating];
        label.style.color = '#f59e0b';
        updateSubmitBtn();
      });
    });

    /* Issue pills */
    formBody.querySelectorAll('.fb-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        formBody.querySelectorAll('.fb-pill').forEach(p => p.classList.remove('selected'));
        if (selectedIssue === pill.dataset.issue) {
          selectedIssue = '';
        } else {
          pill.classList.add('selected');
          selectedIssue = pill.dataset.issue;
        }
      });
    });

    /* Cancel inside body */
    formBody.querySelector('#fbCancelBtn2')?.addEventListener('click', closeForm);

    /* Submit */
    formBody.querySelector('#fbSubmitBtn').addEventListener('click', submitFeedback);
  }

  function highlightStars(stars, val) {
    stars.forEach(s => s.classList.toggle('active', +s.dataset.val <= val));
  }

  function updateSubmitBtn() {
    const btn = formBody?.querySelector('#fbSubmitBtn');
    if (btn) btn.disabled = selectedRating === 0;
  }

  function openForm(auditId) {
    currentAuditId = auditId || '';
    if (!formModal) return;
    buildFormBody();
    formSuccess.classList.remove('show');
    formBody.style.display = '';
    formOverlay.classList.add('open');
    formModal.classList.add('open');
    setTimeout(() => formModal.querySelector('#fbEmail')?.focus(), 120);
  }

  function closeForm() {
    formOverlay?.classList.remove('open');
    formModal?.classList.remove('open');
  }

  async function submitFeedback() {
    const btn     = formBody.querySelector('#fbSubmitBtn');
    const email   = formBody.querySelector('#fbEmail')?.value.trim() || '';
    const comment = formBody.querySelector('#fbComment')?.value.trim() || '';

    if (!selectedRating) return;

    btn.disabled    = true;
    btn.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_id:   currentAuditId,
          email:      email,
          rating:     selectedRating,
          comment:    comment,
          issue_type: selectedIssue,
          source:     'form',
        }),
      });
      if (!res.ok) throw new Error('Server error');
      formBody.style.display = 'none';
      formSuccess.classList.add('show');
      setTimeout(closeForm, 2200);
    } catch (err) {
      btn.disabled    = false;
      btn.textContent = 'Submit Feedback';
      alert('Could not submit feedback. Please try again.');
    }
  }

  /* expose opener globally so other parts of the app can call it */
  window.openFeedbackForm = openForm;


  /* ═══════════════════════════════════════
     FEEDBACK VIEWER MODAL
  ═══════════════════════════════════════ */
  let viewerOverlay, viewerModal, viewerBody;
  let vPage = 1, vPerPage = 15, vTotal = 0;
  let vRating = 0, vSearch = '', vLoading = false;

  function initViewer() {
    viewerOverlay = document.getElementById('fbvOverlay');
    viewerModal   = document.getElementById('fbvModal');
    viewerBody    = document.getElementById('fbvBody');

    if (!viewerModal) return;

    document.getElementById('fbvCloseBtn')?.addEventListener('click', closeViewer);
    viewerOverlay?.addEventListener('click', closeViewer);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && viewerModal.classList.contains('open')) closeViewer();
    });

    document.getElementById('fbvRefreshBtn')?.addEventListener('click', () => {
      vPage = 1; fetchFeedbacks();
    });
    document.getElementById('fbvRatingFilter')?.addEventListener('change', e => {
      vRating = +e.target.value; vPage = 1; fetchFeedbacks();
    });

    let searchTimer;
    document.getElementById('fbvSearch')?.addEventListener('input', e => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { vSearch = e.target.value; vPage = 1; fetchFeedbacks(); }, 350);
    });

    /* open from dropdown */
    document.getElementById('dropFeedbackView')?.addEventListener('click', () => {
      const dd = document.getElementById('hdrDropdown');
      if (dd) dd.classList.remove('open');
      openViewer();
    });

    /* open from sidebar */
    document.getElementById('sidebarFeedbackView')?.addEventListener('click', openViewer);
  }

  function openViewer() {
    if (!viewerModal) return;
    vPage = 1; vRating = 0; vSearch = '';
    const rf = document.getElementById('fbvRatingFilter');
    const sr = document.getElementById('fbvSearch');
    if (rf) rf.value = '0';
    if (sr) sr.value = '';
    viewerOverlay.classList.add('open');
    viewerModal.classList.add('open');
    fetchFeedbacks();
  }

  function closeViewer() {
    viewerOverlay?.classList.remove('open');
    viewerModal?.classList.remove('open');
  }

  async function fetchFeedbacks() {
    if (vLoading) return;
    vLoading = true;
    showViewerLoading();
    try {
      const params = new URLSearchParams({
        page: vPage, per_page: vPerPage,
        rating: vRating, search: vSearch,
      });
      const res  = await fetch(`/api/feedback-list?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      vTotal = data.total;
      renderViewer(data);
    } catch (err) {
      viewerBody.innerHTML = `<div class="fbv-empty"><div class="fbv-empty-icon">⚠️</div>Could not load feedbacks: ${escFbv(err.message)}</div>`;
    } finally {
      vLoading = false;
    }
  }

  function showViewerLoading() {
    if (!viewerBody) return;
    viewerBody.innerHTML = `
      <div class="fbv-loading">
        <div class="fbv-spinner"></div>
        <span>Loading feedbacks…</span>
      </div>`;
  }

  function renderViewer(data) {
    if (!viewerBody) return;

    const avg   = data.avg_rating;
    const dist  = data.distribution || [];
    const rows  = data.feedbacks    || [];
    const total = data.total        || 0;
    const maxDistCount = Math.max(...dist.map(d => d.count), 1);

    /* KPI row */
    const kpiHtml = `
      <div class="fbv-kpi-row">
        <div class="fbv-kpi">
          <div class="fbv-kpi-label">Total Feedbacks</div>
          <div class="fbv-kpi-value">${total}</div>
          <div class="fbv-kpi-sub">all time</div>
        </div>
        <div class="fbv-kpi">
          <div class="fbv-kpi-label">Avg Rating</div>
          <div class="fbv-kpi-value" style="color:#f59e0b;">${avg ? avg.toFixed(1) : '—'}</div>
          <div class="fbv-kpi-sub">out of 5 ★</div>
        </div>
        <div class="fbv-kpi">
          <div class="fbv-kpi-label">5-Star Reviews</div>
          <div class="fbv-kpi-value" style="color:#10b981;">${dist.find(d => d.rating === 5)?.count || 0}</div>
          <div class="fbv-kpi-sub">excellent ratings</div>
        </div>
        <div class="fbv-kpi">
          <div class="fbv-kpi-label">Low Ratings (≤2)</div>
          <div class="fbv-kpi-value" style="color:#ef4444;">${dist.filter(d => d.rating <= 2).reduce((s, d) => s + d.count, 0)}</div>
          <div class="fbv-kpi-sub">need attention</div>
        </div>
      </div>`;

    /* Rating distribution */
    const distHtml = `
      <div class="fbv-dist-card">
        <div class="fbv-dist-title">Rating Distribution</div>
        ${[5,4,3,2,1].map(r => {
          const item  = dist.find(d => d.rating === r);
          const count = item ? item.count : 0;
          const pct   = Math.round(count / maxDistCount * 100);
          const stars = '★'.repeat(r) + '☆'.repeat(5 - r);
          return `
            <div class="fbv-dist-row">
              <span class="fbv-dist-star">${r} ★</span>
              <div class="fbv-dist-track"><div class="fbv-dist-fill" style="width:${pct}%;background:${r >= 4 ? '#10b981' : r === 3 ? '#f59e0b' : '#ef4444'};"></div></div>
              <span class="fbv-dist-count">${count}</span>
            </div>`;
        }).join('')}
      </div>`;

    /* Table */
    let tableHtml;
    if (!rows.length) {
      tableHtml = `<div class="fbv-table-card"><div class="fbv-empty"><div class="fbv-empty-icon">📭</div>No feedbacks found</div></div>`;
    } else {
      const totalPages = Math.ceil(total / vPerPage);
      tableHtml = `
        <div class="fbv-table-card">
          <div class="fbv-table-header">
            <span class="fbv-table-title">All Feedbacks</span>
            <span class="fbv-table-count">Showing ${rows.length} of ${total}</span>
          </div>
          <div style="overflow-x:auto;">
            <table class="fbv-table">
              <thead>
                <tr>
                  <th>Rating</th>
                  <th>Email</th>
                  <th>Issue Type</th>
                  <th>Comment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    <td><span class="fbv-stars-display">${renderStars(r.rating)}</span></td>
                    <td style="font-size:12.5px;color:#374151;">${escFbv(r.email || '—')}</td>
                    <td>${r.issue_type ? `<span class="fbv-issue-pill">${escFbv(r.issue_type)}</span>` : '<span style="color:#d1d5db;">—</span>'}</td>
                    <td><div class="fbv-comment-text">${escFbv(r.comment || '—')}</div></td>
                    <td class="fbv-date-cell">${fmtDate(r.created_at)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          ${totalPages > 1 ? renderPagination(totalPages) : ''}
        </div>`;
    }

    viewerBody.innerHTML = kpiHtml + distHtml + tableHtml;

    /* attach pagination events */
    viewerBody.querySelectorAll('.fbv-page-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        vPage = +btn.dataset.page;
        fetchFeedbacks();
      });
    });
  }

  function renderPagination(totalPages) {
    const pages = [];
    for (let p = 1; p <= totalPages; p++) pages.push(p);
    return `
      <div class="fbv-pagination">
        <button class="fbv-page-btn" data-page="${vPage - 1}" ${vPage === 1 ? 'disabled' : ''}>‹ Prev</button>
        ${pages.slice(Math.max(0, vPage - 3), Math.min(totalPages, vPage + 2)).map(p =>
          `<button class="fbv-page-btn ${p === vPage ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
        <button class="fbv-page-btn" data-page="${vPage + 1}" ${vPage === totalPages ? 'disabled' : ''}>Next ›</button>
        <span class="fbv-page-info">Page ${vPage} of ${totalPages}</span>
      </div>`;
  }

  function renderStars(rating) {
    return [1,2,3,4,5].map(i =>
      `<span class="${i <= rating ? '' : 'empty'}">★</span>`
    ).join('');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
             + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  function escFbv(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* expose viewer opener globally */
  window.openFeedbackViewer = openViewer;


  /* ── Boot both on DOMContentLoaded ── */
  function boot() {
    initForm();
    initViewer();

    /* open form from sidebar "Feedback form" link */
    document.querySelectorAll('.fb-open-form-trigger').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); openForm(''); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();

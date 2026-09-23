const state = {
  data: null,
  query: "",
  tracker: "all",
  priorities: new Set(),
  savedOnly: false,
  saved: loadSaved(),
  limit: 12,
  expanded: new Set(),
};

const elements = {};
const hasDom = typeof document !== "undefined" && typeof window !== "undefined";
const staticDataBase = hasDom
  ? document.documentElement.dataset.staticDataBase || (window.location.hostname.endsWith(".github.io") ? "./data" : "")
  : "";

if (hasDom) {
  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    configureHostingMode();
    bindEvents();
    updateSavedCount();
    loadData(new URLSearchParams(window.location.search).get("week") || "");
  });
}

function cacheElements() {
  const ids = [
    "loading-state", "app-content", "error-state", "error-message", "retry-button",
    "issue-label", "issue-date", "hero-eyebrow", "digest-title", "digest-summary",
    "digest-keywords", "digest-expand", "editor-note", "updated-time", "stat-papers",
    "stat-collected", "stat-must-read", "stat-lab-ideas", "tracker-status",
    "must-read-grid", "ideas-list", "result-summary", "paper-search", "filter-toggle",
    "filter-panel", "tracker-filters", "priority-filters", "saved-only", "clear-filters",
    "active-chips", "paper-list", "empty-state", "empty-reset", "load-more",
    "active-filter-count", "week-select", "saved-count", "saved-nav-button",
    "search-nav-button", "footer-update", "mobile-menu-button", "nav-links",
    "feedback-form", "feedback-name", "feedback-category", "feedback-message",
    "feedback-website", "feedback-status", "feedback-submit",
    "breadcrumb-current",
  ];
  ids.forEach((id) => { elements[toCamel(id)] = document.getElementById(id); });
}

function configureHostingMode() {
  if (!staticDataBase) return;
  document.querySelectorAll('a[href="#feedback"]').forEach((link) => link.remove());
  const feedbackSection = document.getElementById("feedback");
  if (feedbackSection) feedbackSection.hidden = true;
  document.querySelectorAll('a[href="#lab-ideas"]').forEach((link) => link.remove());
  const ideasSection = document.getElementById("lab-ideas");
  if (ideasSection) ideasSection.hidden = true;
  elements.statLabIdeas?.closest(".stat-block")?.remove();
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function bindEvents() {
  elements.retryButton.addEventListener("click", () => loadData(new URLSearchParams(window.location.search).get("week") || ""));
  elements.weekSelect.addEventListener("change", (event) => {
    setWeekQuery(event.target.value);
    loadData(event.target.value);
  });
  elements.paperSearch.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.limit = 12;
    renderLibrary();
  });

  elements.trackerFilters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter='tracker']");
    if (!button) return;
    state.tracker = button.dataset.value;
    state.limit = 12;
    elements.trackerFilters.querySelectorAll("button").forEach((item) => {
      item.classList.toggle("is-active", item === button);
    });
    renderSelectionViews();
  });

  elements.priorityFilters.addEventListener("change", (event) => {
    const input = event.target.closest("input[type='checkbox']");
    if (!input) return;
    if (input.checked) state.priorities.add(input.value);
    else state.priorities.delete(input.value);
    state.limit = 12;
    renderLibrary();
  });

  elements.savedOnly.addEventListener("change", (event) => {
    state.savedOnly = event.target.checked;
    state.limit = 12;
    renderLibrary();
  });

  elements.clearFilters.addEventListener("click", resetFilters);
  elements.emptyReset.addEventListener("click", resetFilters);
  elements.loadMore.addEventListener("click", () => {
    state.limit += 12;
    renderLibrary();
  });

  elements.filterToggle.addEventListener("click", () => {
    const isOpen = elements.filterToggle.getAttribute("aria-expanded") === "true";
    elements.filterToggle.setAttribute("aria-expanded", String(!isOpen));
    elements.filterPanel.classList.toggle("is-open", !isOpen);
  });

  elements.savedNavButton.addEventListener("click", () => {
    state.savedOnly = true;
    elements.savedOnly.checked = true;
    renderLibrary();
    document.getElementById("papers").scrollIntoView({ behavior: "smooth" });
  });

  elements.searchNavButton.addEventListener("click", () => focusSearch(false));
  if (!staticDataBase) elements.feedbackForm.addEventListener("submit", submitFeedback);
  elements.paperList.addEventListener("click", handleCardAction);
  elements.mustReadGrid.addEventListener("click", handleCardAction);

  elements.digestExpand.addEventListener("click", () => {
    const isExpanded = elements.digestExpand.getAttribute("aria-expanded") === "true";
    elements.digestExpand.setAttribute("aria-expanded", String(!isExpanded));
    elements.editorNote.hidden = isExpanded;
    elements.digestExpand.innerHTML = isExpanded
      ? 'Read the editor’s note <span aria-hidden="true">↓</span>'
      : 'Close the editor’s note <span aria-hidden="true">↑</span>';
  });

  elements.mobileMenuButton.addEventListener("click", () => {
    const isOpen = elements.mobileMenuButton.getAttribute("aria-expanded") === "true";
    elements.mobileMenuButton.setAttribute("aria-expanded", String(!isOpen));
    elements.navLinks.classList.toggle("is-open", !isOpen);
  });

  elements.navLinks.addEventListener("click", () => {
    elements.navLinks.classList.remove("is-open");
    elements.mobileMenuButton.setAttribute("aria-expanded", "false");
  });

  window.addEventListener("hashchange", () => {
    const week = new URLSearchParams(window.location.search).get("week") || "";
    if (state.data && week && week !== state.data.weekKey) loadData(week);
    else {
      expandPaperFromHash(true);
      scrollToCurrentSection();
    }
  });

  document.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName;
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
      event.preventDefault();
      focusSearch(true);
    }
    if (event.key === "Escape" && document.activeElement === elements.paperSearch) {
      elements.paperSearch.blur();
    }
  });
}

async function submitFeedback(event) {
  event.preventDefault();
  if (!elements.feedbackForm.reportValidity()) return;

  elements.feedbackSubmit.disabled = true;
  elements.feedbackStatus.className = "is-sending";
  elements.feedbackStatus.textContent = "Sending feedback…";

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: elements.feedbackName.value,
        category: elements.feedbackCategory.value,
        message: elements.feedbackMessage.value,
        website: elements.feedbackWebsite.value,
        page: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not send feedback.");

    elements.feedbackForm.reset();
    elements.feedbackStatus.className = "is-success";
    elements.feedbackStatus.textContent = "Thank you — your feedback was saved.";
  } catch (error) {
    elements.feedbackStatus.className = "is-error";
    elements.feedbackStatus.textContent = error.message || "Could not send feedback. Please try again.";
  } finally {
    elements.feedbackSubmit.disabled = false;
  }
}

async function loadData(week = "") {
  showLoading();
  try {
    const endpoint = staticDataBase
      ? `${staticDataBase}/${week ? encodeURIComponent(week) : "latest"}.json`
      : `/api/data${week ? `?week=${encodeURIComponent(week)}` : ""}`;
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    state.data = payload;
    let savedChanged = false;
    for (const paper of payload.papers || []) {
      if (paper.paperKey && paper.id !== paper.paperKey && state.saved.has(paper.id)) {
        state.saved.delete(paper.id);
        state.saved.add(paper.paperKey);
        savedChanged = true;
      }
    }
    if (savedChanged) persistSaved();
    state.limit = 12;
    state.expanded.clear();
    renderPage();
    elements.loadingState.hidden = true;
    elements.errorState.hidden = true;
    elements.appContent.hidden = false;
  } catch (error) {
    elements.loadingState.hidden = true;
    elements.appContent.hidden = true;
    elements.errorState.hidden = false;
    elements.errorMessage.textContent = error.message || "An unknown error occurred.";
  }
}

function showLoading() {
  elements.loadingState.hidden = false;
  elements.errorState.hidden = true;
  if (!state.data) elements.appContent.hidden = true;
}

function renderPage() {
  renderIssue();
  renderWeekSelect();
  renderMustRead();
  renderIdeas();
  renderLibrary();
  updateSavedCount();
  expandPaperFromHash(true);
  scrollToCurrentSection();
}

function scrollToCurrentSection() {
  if (!window.location.hash || window.location.hash.startsWith("#paper-")) return;
  let targetId;
  try {
    targetId = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return;
  }
  const target = document.getElementById(targetId);
  if (target) window.setTimeout(() => target.scrollIntoView({ block: "start" }), 0);
}

function expandPaperFromHash(scroll = false) {
  if (!state.data) return;
  const match = window.location.hash.match(/^#paper-([a-z0-9]+)$/i);
  if (!match || !state.data.papers.some((paper) => paper.id === match[1])) return;
  const paperId = match[1];
  if (!filteredPapers().some((paper) => paper.id === paperId)) {
    state.query = "";
    state.tracker = "all";
    state.priorities.clear();
    state.savedOnly = false;
    elements.paperSearch.value = "";
    elements.savedOnly.checked = false;
    elements.trackerFilters.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.value === "all");
    });
    elements.priorityFilters.querySelectorAll("input").forEach((input) => { input.checked = false; });
  }
  const position = rankPapersForTracker(state.data.papers, state.tracker).findIndex((paper) => paper.id === paperId);
  if (position >= state.limit) state.limit = position + 1;
  state.expanded.add(paperId);
  renderLibrary();
  if (scroll) {
    window.setTimeout(() => {
      document.getElementById(`paper-${paperId}`)?.scrollIntoView({ block: "start" });
    }, 0);
  }
}

function renderIssue() {
  const { data } = state;
  const digest = data.digest || {};
  const dateLabel = issueDateLabel(digest, data.weekKey);
  const generated = new Date(data.generatedAt);

  elements.issueLabel.textContent = dateLabel || "WEEKLY REVIEW";
  elements.breadcrumbCurrent.textContent = dateLabel || "this week";
  elements.issueDate.textContent = dateLabel;
  elements.heroEyebrow.textContent = data.site?.eyebrow || "LAB WEEKLY RESEARCH REVIEW";
  elements.digestTitle.textContent = digestHeadline(digest);
  elements.digestSummary.textContent = digest.summary || data.site?.description || "";
  elements.editorNote.textContent = digest.executiveSummary || digest.summary || "";
  elements.digestExpand.hidden = !digest.executiveSummary || digest.executiveSummary === digest.summary;

  elements.digestKeywords.innerHTML = (digest.keywords || [])
    .map((keyword) => `<span class="topic-tag">${escapeHtml(keyword)}</span>`)
    .join("");

  elements.updatedTime.textContent = Number.isNaN(generated.getTime())
    ? ""
    : `Updated ${formatDateTime(generated)}`;
  elements.footerUpdate.textContent = Number.isNaN(generated.getTime())
    ? ""
    : `Last updated ${formatDateTime(generated)}`;
  elements.statPapers.textContent = formatNumber(data.stats?.papers || 0);
  elements.statCollected.textContent = formatCompactNumber(data.stats?.collected || 0);
  elements.statMustRead.textContent = formatNumber(data.stats?.mustRead || 0);
  elements.statLabIdeas.textContent = formatNumber(data.stats?.labIdeas || 0);

  const editorial = data.editorialStage || {};
  const health = editorial.status === "success"
    ? `Editorial ${escapeHtml(editorial.model || "model")} · ${escapeHtml(editorial.effort || "")}`
    : `Editorial preview · ${escapeHtml(editorial.errorCategory || editorial.status || "status unavailable")}`;
  elements.trackerStatus.innerHTML = `<div class="tracker-row tracker-health"><strong>${health}</strong></div>` + (data.trackers || []).map((tracker) => `
    <div class="tracker-row">
      <span class="tracker-dot" aria-hidden="true"></span>
      <strong>${escapeHtml(tracker.shortLabel)}</strong>
      <span>${tracker.collected == null ? "Collected ?" : `${formatNumber(tracker.collected)} collected`} · ${tracker.screened == null ? "screened unknown" : `${formatNumber(tracker.screened)} screened`} · ${formatNumber(tracker.reviewed)} reviewed · ${escapeHtml(tracker.screenStatus || "unknown")}</span>
    </div>
  `).join("");
}

function renderWeekSelect() {
  elements.weekSelect.innerHTML = (state.data.availableWeeks || []).map((week) => `
    <option value="${escapeHtml(week)}" ${week === state.data.weekKey ? "selected" : ""}>
      ${formatWeekOption(week)}
    </option>
  `).join("");
}

function renderMustRead() {
  const selected = selectTopPapers(state.data.papers, state.tracker, 5);
  elements.mustReadGrid.innerHTML = selected.map((paper) => leadCardMarkup(paper)).join("");
}

function leadCardMarkup(paper) {
  const summary = reasonForTracker(paper, state.tracker) || paper.whyCare || paper.blurb || paper.labUse || "Selected as a priority paper this week.";
  return `
    <article class="lead-paper-card">
      <div class="card-topline">
        ${priorityMarkup(paper)}
        ${saveButtonMarkup(paper)}
      </div>
      ${journalMarkup(paper)}
      <h3>${paperLinkMarkup(paper)}</h3>
      <p class="paper-source">${escapeHtml(sourceLine(paper))}</p>
      <p class="paper-blurb korean-copy" lang="ko">${escapeHtml(summary)}</p>
      <div class="lead-paper-footer">
      <a class="paper-link" href="${paperAnalysisHref(paper)}">Read analysis</a>
        <span class="score-mark">relevance ${formatNumber(scoreForTracker(paper, state.tracker))}</span>
      </div>
    </article>
  `;
}

function renderIdeas() {
  const ideas = rankPapersForTracker(state.data.papers, state.tracker)
    .filter((paper) => paper.labUse).slice(0, 4);
  elements.ideasList.innerHTML = ideas.map((paper, index) => `
    <article class="idea-item">
      <span class="idea-number">0${index + 1}</span>
      <div>
        ${journalMarkup(paper, "idea-journal")}
        <h3>${escapeHtml(paper.title)}</h3>
        <p class="korean-copy" lang="ko">${escapeHtml(paper.labUse)}</p>
        <a href="${paperAnalysisHref(paper)}">Analysis &amp; first action →</a>
      </div>
    </article>
  `).join("");
}

function renderLibrary() {
  if (!state.data) return;
  const filtered = filteredPapers();
  const visible = filtered.slice(0, state.limit);
  elements.paperList.innerHTML = visible.map((paper, index) => paperCardMarkup(paper, index)).join("");
  elements.resultSummary.textContent = `${formatNumber(filtered.length)} of ${formatNumber(state.data.papers.length)} papers`;
  elements.emptyState.hidden = filtered.length > 0;
  elements.loadMore.hidden = filtered.length <= state.limit;
  if (!elements.loadMore.hidden) {
    elements.loadMore.textContent = `Load more · ${formatNumber(filtered.length - state.limit)} remaining`;
  }
  renderActiveChips();
}

function filteredPapers() {
  const query = normalizeSearch(state.query);
  return state.data.papers.filter((paper) => {
    if (!matchesTracker(paper, state.tracker)) return false;
    if (state.priorities.size && !state.priorities.has(paper.priority)) return false;
    if (state.savedOnly && !isSaved(paper)) return false;
    if (!query) return true;
    const haystack = normalizeSearch([
      paper.title, paper.journal, paper.source, paper.lane, paper.priorityLabel,
      paper.whyCare, paper.labUse, paper.takeaway, ...(paper.keywords || []), ...(paper.authors || []),
    ].filter(Boolean).join(" "));
    return query.split(/\s+/).every((token) => haystack.includes(token));
  }).sort((a, b) => compareForTracker(a, b, state.tracker));
}

function paperCardMarkup(paper, index) {
  const globalIndex = String(index + 1).padStart(2, "0");
  const summary = reasonForTracker(paper, state.tracker) || paper.whyCare || paper.blurb || paper.labUse || "Selected for this week’s research review.";
  const detailsOpen = state.expanded.has(paper.id);
  const tags = (paper.keywords || []).slice(0, 6).map((keyword) =>
    `<span class="keyword">${escapeHtml(keyword)}</span>`
  ).join("");

  return `
    <article class="paper-card" id="paper-${escapeHtml(paper.id)}">
      <div class="paper-index">
        <span>${globalIndex}</span>
        <span class="tracker-name">${escapeHtml(shortTracker(paper.tracker))}</span>
      </div>
      <div class="paper-main">
        <div class="paper-topline">${priorityMarkup(paper)}</div>
        ${journalMarkup(paper)}
        <h3>${paperLinkMarkup(paper)}</h3>
        <p class="paper-meta">${escapeHtml(sourceLine(paper))}</p>
        <p class="paper-summary korean-copy" lang="ko">${escapeHtml(summary)}</p>
        ${tags ? `<div class="keyword-list">${tags}</div>` : ""}
      </div>
      <aside class="paper-side">
        <div class="score-box"><strong>${formatNumber(scoreForTracker(paper, state.tracker))}</strong><span>relevance</span></div>
        ${paper.compbioMembership === "pending" && state.tracker === "compbio"
          ? '<span class="lane-label">CompBio membership pending</span>'
          : paper.lane ? `<span class="lane-label">${escapeHtml(paper.lane)}</span>` : ""}
        <button class="detail-toggle" type="button" data-action="details" data-id="${escapeHtml(paper.id)}" aria-expanded="${detailsOpen}">
          ${detailsOpen ? "Close analysis" : "Open analysis"}
        </button>
      </aside>
      ${saveButtonMarkup(paper)}
      ${detailsOpen ? detailsMarkup(paper) : ""}
    </article>
  `;
}

function renderSelectionViews() {
  renderMustRead();
  renderIdeas();
  renderLibrary();
}

function labScore(paper) {
  const raw = paper.lensRanks?.lab;
  const ranked = typeof raw === "number" ? raw : Number.NaN;
  if (Number.isFinite(ranked)) return ranked;
  const source = paper.sourceScore ?? paper.score;
  return typeof source === "number" && Number.isFinite(source) ? source : 0;
}

function computationalScore(paper) {
  const raw = paper.lensRanks?.computational;
  const ranked = typeof raw === "number" ? raw : Number.NaN;
  if (Number.isFinite(ranked)) return ranked;
  const source = paper.sourceScore ?? paper.score;
  const legacy = typeof source === "number" && Number.isFinite(source) ? source : 0;
  return paper.tracker === "compbio" ? legacy : Math.round(legacy * 0.35);
}

function scoreForTracker(paper, tracker) {
  return tracker === "compbio" ? computationalScore(paper) : labScore(paper);
}

function reasonForTracker(paper, tracker) {
  const key = tracker === "compbio" ? "computational" : "main";
  return paper.editorialRerankFallback ? "" : paper.lensReasons?.[key] || "";
}

function compareRankTies(a, b) {
  const evidenceDelta = Number(b.audienceScores?.evidenceStrength || 0) - Number(a.audienceScores?.evidenceStrength || 0);
  if (evidenceDelta) return evidenceDelta;
  const venueDelta = Number(b.audienceScores?.venueQuality || 0) - Number(a.audienceScores?.venueQuality || 0);
  if (venueDelta) return venueDelta;
  return String(a.title || "").localeCompare(String(b.title || ""), "en");
}

function libraryGroup(paper) {
  if (!paper.lensRanks) return paper.tracker === "compbio" ? 2 : 0;
  if (paper.mainPageEligible === true && paper.computationalOnly !== true) return 0;
  return paper.computationalOnly === true ? 2 : 1;
}

function compareForTracker(a, b, tracker = "all") {
  if (tracker === "all") {
    const groupDelta = libraryGroup(a) - libraryGroup(b);
    if (groupDelta) return groupDelta;
  }
  const scoreDelta = scoreForTracker(b, tracker) - scoreForTracker(a, tracker);
  return scoreDelta || compareRankTies(a, b);
}

function rankPapersForTracker(papers, tracker = "all") {
  return [...papers]
    .filter((paper) => matchesTracker(paper, tracker))
    .sort((a, b) => compareForTracker(a, b, tracker));
}

function isMainTopEligible(paper, tracker = "all") {
  if (tracker === "compbio") return matchesTracker(paper, tracker);
  if (!paper.lensRanks) return paper.tracker !== "compbio";
  return paper.mainPageEligible === true && paper.computationalOnly !== true;
}

function selectTopPapers(papers, tracker = "all", limit = 5) {
  return rankPapersForTracker(papers, tracker)
    .filter((paper) => isMainTopEligible(paper, tracker))
    .slice(0, limit);
}

function detailsMarkup(paper) {
  const brief = paper.shortSummary || paper.blurb || paper.whyCare || "A concise review is not available for this paper yet.";
  const insights = [];
  if (paper.takeaway) insights.push(detailBlock("Key takeaway", paper.takeaway));
  if (paper.labUse) insights.push(detailBlock("For our lab", paper.labUse));
  if (paper.skepticism) insights.push(detailBlock("What to question", paper.skepticism));

  const nextAction = paper.nextAction ? `
    <section class="detail-next-action">
      <h4>First action</h4>
      <p class="korean-copy" lang="ko">${escapeHtml(paper.nextAction)}</p>
    </section>
  ` : "";

  const abstract = paper.abstract ? `
    <details class="abstract-disclosure">
      <summary>Read abstract <span aria-hidden="true">＋</span></summary>
      <p class="abstract-copy" lang="en">${escapeHtml(paper.abstract)}</p>
    </details>
  ` : "";

  const source = paper.url ? `
    <a class="detail-link detail-source-link" href="${safeUrl(paper.url)}" target="_blank" rel="noopener noreferrer">Open source paper ↗</a>
  ` : "";

  return `
    <div class="paper-details">
      <section class="detail-brief">
        <h4>In brief</h4>
        <p class="korean-copy" lang="ko">${escapeHtml(brief)}</p>
      </section>
      ${insights.length ? `<div class="detail-insights">${insights.join("")}</div>` : ""}
      ${nextAction}
      ${(abstract || source) ? `<div class="detail-footer">${abstract}${source}</div>` : ""}
    </div>
  `;
}

function detailBlock(title, content) {
  return `<section class="detail-block"><h4>${escapeHtml(title)}</h4><p class="korean-copy" lang="ko">${escapeHtml(content)}</p></section>`;
}

function priorityMarkup(paper) {
  return `<span class="priority-badge ${escapeHtml(paper.priority)}">${escapeHtml(paper.priorityLabel)}</span>`;
}

function saveButtonMarkup(paper) {
  const saved = isSaved(paper);
  return `
    <button
      class="save-button ${saved ? "is-saved" : ""}"
      type="button"
      data-action="save"
      data-id="${escapeHtml(paper.id)}"
      aria-label="${saved ? "Remove from saved" : "Save paper"}: ${escapeHtml(paper.title)}"
      aria-pressed="${saved}"
      title="${saved ? "Remove from saved" : "Save for later"}"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.5 3.5h11v17l-5.5-3.7-5.5 3.7z" /></svg>
    </button>
  `;
}

function paperLinkMarkup(paper) {
  if (!paper.url) return escapeHtml(paper.title);
  return `<a href="${safeUrl(paper.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.title)}</a>`;
}

function handleCardAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "save") toggleSaved(id);
  if (action === "details") {
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    renderLibrary();
    if (state.expanded.has(id)) {
      requestAnimationFrame(() => document.getElementById(`paper-${id}`)?.scrollIntoView({ block: "nearest" }));
    }
  }
}

function toggleSaved(id) {
  const paper = state.data?.papers.find((item) => item.id === id);
  const key = paper ? savedIdentity(paper) : id;
  if (state.saved.has(key) || state.saved.has(id)) {
    state.saved.delete(key);
    state.saved.delete(id);
  } else state.saved.add(key);
  persistSaved();
  updateSavedCount();
  renderSelectionViews();
}

function loadSaved() {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem("papertrail:saved") || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return new Set();
  }
}

function isSaved(paper) {
  return state.saved.has(savedIdentity(paper)) || state.saved.has(paper.id);
}

function savedIdentity(paper) {
  return paper.paperKey || paper.id;
}

function matchesTracker(paper, tracker) {
  if (tracker === "all") return true;
  if (tracker === "compbio") {
    if (paper.compbioMembership === "included") return true;
    if (paper.compbioMembership === "pending") {
      return computationalScore(paper) >= (paper.tracker === "compbio" ? 40 : 60);
    }
    return paper.compbioMembership == null && paper.tracker === "compbio";
  }
  return paper.tracker === tracker;
}

function paperAnalysisHref(paper, week = state.data?.weekKey || "") {
  return `?week=${encodeURIComponent(week)}#paper-${encodeURIComponent(paper.id)}`;
}

function setWeekQuery(week) {
  const url = new URL(window.location.href);
  if (week) url.searchParams.set("week", week);
  else url.searchParams.delete("week");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function persistSaved() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem("papertrail:saved", JSON.stringify([...state.saved]));
  } catch (_) {
    // The site remains fully usable when storage is disabled.
  }
}

function updateSavedCount() {
  elements.savedCount.textContent = formatNumber(state.saved.size);
}

function resetFilters() {
  state.query = "";
  state.tracker = "all";
  state.priorities.clear();
  state.savedOnly = false;
  state.limit = 12;
  elements.paperSearch.value = "";
  elements.savedOnly.checked = false;
  elements.trackerFilters.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.value === "all");
  });
  elements.priorityFilters.querySelectorAll("input").forEach((input) => { input.checked = false; });
  renderSelectionViews();
}

function renderActiveChips() {
  const chips = [];
  if (state.query) chips.push({ key: "query", label: `Search: ${state.query}` });
  if (state.tracker !== "all") chips.push({ key: "tracker", label: shortTracker(state.tracker) });
  state.priorities.forEach((priority) => chips.push({ key: `priority:${priority}`, label: priorityLabel(priority) }));
  if (state.savedOnly) chips.push({ key: "saved", label: "Saved papers" });

  elements.activeChips.innerHTML = chips.map((chip) => `
    <button class="active-chip" type="button" data-chip="${escapeHtml(chip.key)}">${escapeHtml(chip.label)} ×</button>
  `).join("");
  elements.activeFilterCount.textContent = chips.length ? `(${chips.length})` : "";
  elements.activeChips.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => removeChip(button.dataset.chip));
  });
}

function removeChip(key) {
  if (key === "query") {
    state.query = "";
    elements.paperSearch.value = "";
  } else if (key === "tracker") {
    state.tracker = "all";
    elements.trackerFilters.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.value === "all");
    });
  } else if (key === "saved") {
    state.savedOnly = false;
    elements.savedOnly.checked = false;
  } else if (key.startsWith("priority:")) {
    const value = key.split(":")[1];
    state.priorities.delete(value);
    const input = elements.priorityFilters.querySelector(`input[value="${CSS.escape(value)}"]`);
    if (input) input.checked = false;
  }
  state.limit = 12;
  renderSelectionViews();
}

function focusSearch(instant = false) {
  document.getElementById("papers").scrollIntoView({ behavior: instant ? "auto" : "smooth" });
  window.setTimeout(() => elements.paperSearch.focus(), instant ? 0 : 220);
}

function sourceLine(paper) {
  const parts = [];
  if (paper.published) {
    const date = parseIsoDate(paper.published);
    parts.push(`Published: ${date ? formatEnglishDate(date) : paper.published}`);
  }
  if (paper.authors?.length) {
    const visibleAuthors = paper.authors.slice(0, 4).join(", ");
    parts.push(paper.authors.length > 4 ? `${visibleAuthors}, et al.` : visibleAuthors);
  }
  return parts.join(" | ");
}

function journalMarkup(paper, className = "journal-citation") {
  const journal = paper.journal || paper.source || shortTracker(paper.tracker);
  const label = escapeHtml(journal);
  const content = paper.url
    ? `<a href="${safeUrl(paper.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    : label;
  return `<p class="${className}">${content}</p>`;
}

function shortTracker(value) {
  return ({ flagship: "Flagship", preprints: "Preprints", compbio: "CompBio / AI" })[value] || value;
}

function priorityLabel(value) {
  return ({
    "must-read": "Must read",
    "high-interest": "High interest",
    sleeper: "Sleeper",
    watchlist: "Watchlist",
  })[value] || value;
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ko-KR");
}

function digestHeadline(digest) {
  const theme = String(digest.theme || "research").trim();
  const cleaned = theme
    .replaceAll("/", " & ")
    .replace(/\s+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
  return `This week in ${cleaned}`;
}

function issueDateLabel(digest, weekKey) {
  const start = parseIsoDate(digest.windowStart);
  const end = parseIsoDate(digest.windowEnd);
  if (start && end) {
    const month = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(end);
    if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
      return `${start.getUTCDate()}–${end.getUTCDate()} ${month} ${end.getUTCFullYear()}`;
    }
    return `${formatEnglishDate(start)} — ${formatEnglishDate(end)}`;
  }
  return formatWeekOption(weekKey);
}

function parseIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEnglishDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatWeekOption(value) {
  const match = String(value || "").match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return value || "Weekly review";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return formatEnglishDate(date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function safeUrl(value) {
  try {
    const url = new URL(value, hasDom ? window.location.origin : "https://papertrail.invalid");
    if (!["http:", "https:"].includes(url.protocol)) return "#";
    return escapeHtml(url.href);
  } catch (_) {
    return "#";
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    compareForTracker,
    computationalScore,
    isMainTopEligible,
    matchesTracker,
    paperAnalysisHref,
    labScore,
    rankPapersForTracker,
    reasonForTracker,
    savedIdentity,
    scoreForTracker,
    selectTopPapers,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

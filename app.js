const state = {
  bootstrap: null,
  gigs: [],
  selectedGigId: null,
  activeCategory: "all",
  activeRole: "buyer",
  filters: {
    search: "",
    delivery: "all",
    sort: "recommended",
  },
};

const TONE_SEQUENCE = ["cyan", "blue", "violet", "lime", "amber"];
const CATEGORY_TONES = {
  all: "cyan",
  "ai-automation": "cyan",
  "web-dev": "blue",
  branding: "violet",
  "video-editing": "lime",
  "deck-copy": "amber",
  translation: "blue",
};

const elements = {
  heroDescription: document.querySelector("#hero-description"),
  heroStats: document.querySelector("#hero-stats"),
  heroPillars: document.querySelector("#hero-pillars"),
  heroFlowPreview: document.querySelector("#hero-flow-preview"),
  insightGrid: document.querySelector("#insight-grid"),
  categoryStrip: document.querySelector("#category-strip"),
  gigGrid: document.querySelector("#gig-grid"),
  gigDetail: document.querySelector("#gig-detail"),
  workspaceSwitcher: document.querySelector("#workspace-switcher"),
  workspacePanel: document.querySelector("#workspace-panel"),
  briefList: document.querySelector("#brief-list"),
  flowGrid: document.querySelector("#flow-grid"),
  roadmapGrid: document.querySelector("#roadmap-grid"),
  searchInput: document.querySelector("#search-input"),
  deliveryFilter: document.querySelector("#delivery-filter"),
  sortFilter: document.querySelector("#sort-filter"),
};

let motionTargets = [];
let motionBound = false;
let motionFrame = null;

boot();

async function boot() {
  bindEvents();
  await loadBootstrap();
  await loadGigs();
  setupMotion();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", async (event) => {
    state.filters.search = event.target.value.trim();
    await loadGigs();
  });

  elements.deliveryFilter.addEventListener("change", async (event) => {
    state.filters.delivery = event.target.value;
    await loadGigs();
  });

  elements.sortFilter.addEventListener("change", async (event) => {
    state.filters.sort = event.target.value;
    await loadGigs();
  });
}

async function loadBootstrap() {
  const response = await fetch("/api/bootstrap");
  const payload = await response.json();
  state.bootstrap = payload;
  state.activeRole = payload.defaultRole || "buyer";

  renderHero(payload);
  renderInsights(payload.insights || []);
  renderCategories(payload.categories || []);
  renderDeliveryOptions(payload.filters?.delivery || []);
  renderSortOptions(payload.filters?.sort || []);
  renderWorkspaceTabs(payload.workspaces || {});
  renderWorkspace();
  renderBriefs(payload.briefs || []);
  renderFlow(payload.flow || []);
  renderRoadmap(payload.roadmap || []);
}

async function loadGigs() {
  const params = new URLSearchParams({
    search: state.filters.search,
    category: state.activeCategory,
    delivery: state.filters.delivery,
    sort: state.filters.sort,
  });

  const response = await fetch(`/api/gigs?${params.toString()}`);
  const payload = await response.json();
  state.gigs = payload.items || [];

  if (!state.gigs.length) {
    state.selectedGigId = null;
  } else if (!state.gigs.some((gig) => gig.id === state.selectedGigId)) {
    state.selectedGigId = state.gigs[0].id;
  }

  renderGigGrid();
  renderGigDetail();
}

function renderHero(payload) {
  elements.heroDescription.textContent = payload.hero?.description || "";

  elements.heroStats.innerHTML = "";
  (payload.hero?.stats || []).forEach((stat) => {
    const card = document.createElement("div");
    card.className = "signal-card";
    card.innerHTML = `
      <span class="signal-label">${escapeHtml(stat.label)}</span>
      <span class="signal-value">${escapeHtml(stat.value)}</span>
    `;
    elements.heroStats.appendChild(card);
  });

  elements.heroPillars.innerHTML = "";
  (payload.hero?.pillars || []).forEach((item) => {
    const pill = document.createElement("div");
    pill.className = "pill";
    pill.textContent = item;
    elements.heroPillars.appendChild(pill);
  });

  elements.heroFlowPreview.innerHTML = "";
  (payload.hero?.flowPreview || []).forEach((item) => {
    const block = document.createElement("div");
    block.className = "mini-flow-item";
    block.innerHTML = `
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.copy)}</span>
    `;
    elements.heroFlowPreview.appendChild(block);
  });
}

function renderInsights(items) {
  elements.insightGrid.innerHTML = "";

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "insight-card";
    card.dataset.tone = toneForIndex(index);
    card.innerHTML = `
      <span class="insight-index">0${index + 1}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.copy)}</p>
    `;
    elements.insightGrid.appendChild(card);
  });
}

function renderCategories(categories) {
  elements.categoryStrip.innerHTML = "";

  const allChip = createCategoryChip({
    id: "all",
    label: "全部服务",
    description: "先验证市场宽度，再看重点类目。",
    averagePrice: "看全部",
  });
  elements.categoryStrip.appendChild(allChip);

  categories.forEach((category) => {
    elements.categoryStrip.appendChild(createCategoryChip(category));
  });
}

function createCategoryChip(category) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = `category-chip${state.activeCategory === category.id ? " active" : ""}`;
  chip.dataset.tone = toneForCategory(category.id);
  chip.innerHTML = `
    <strong>${escapeHtml(category.label)}</strong>
    <span>${escapeHtml(category.description || "")}</span>
    <small>${escapeHtml(category.averagePrice || "")}</small>
  `;

  chip.addEventListener("click", async () => {
    state.activeCategory = category.id;
    renderCategories(state.bootstrap?.categories || []);
    await loadGigs();
  });

  return chip;
}

function renderDeliveryOptions(items) {
  elements.deliveryFilter.innerHTML = `<option value="all">全部</option>`;
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    elements.deliveryFilter.appendChild(option);
  });
}

function renderSortOptions(items) {
  elements.sortFilter.innerHTML = "";
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    elements.sortFilter.appendChild(option);
  });
}

function renderGigGrid() {
  elements.gigGrid.innerHTML = "";

  if (!state.gigs.length) {
    elements.gigGrid.innerHTML = `<div class="empty-state">当前筛选条件下还没有匹配的服务。可以换个类目，或者把搜索词放宽一些。</div>`;
    return;
  }

  state.gigs.forEach((gig) => {
    const card = document.createElement("article");
    card.className = `gig-card${gig.id === state.selectedGigId ? " active" : ""}`;
    card.dataset.tone = toneForCategory(gig.category);
    card.innerHTML = `
      <div class="gig-topline">
        <span class="tag">${escapeHtml(gig.categoryLabel)}</span>
        <span class="trust-badge">${escapeHtml(gig.featuredLabel)}</span>
      </div>
      <div class="gig-preview">
        <div class="gig-preview-head">
          <span class="gig-preview-label">delivery protocol</span>
          <code class="gig-preview-code">${escapeHtml(gig.bestFor)}</code>
        </div>
        <div class="gig-preview-grid">
          <div class="gig-preview-node">
            <span>ETA</span>
            <strong>${escapeHtml(gig.deliveryWindow)}</strong>
          </div>
          <div class="gig-preview-node">
            <span>FROM</span>
            <strong>${escapeHtml(gig.priceFrom)}</strong>
          </div>
          <div class="gig-preview-node">
            <span>LOAD</span>
            <strong>${escapeHtml((gig.deliverables || []).length)} items</strong>
          </div>
        </div>
        <div class="gig-preview-stream">
          <span class="gig-preview-bar"></span>
          <span class="gig-preview-bar"></span>
          <span class="gig-preview-bar"></span>
          <span class="gig-preview-bar"></span>
        </div>
      </div>
      <div>
        <h3>${escapeHtml(gig.title)}</h3>
        <p class="gig-meta">${escapeHtml(gig.seller)} · ${escapeHtml(gig.city)} · ${escapeHtml(gig.rating)}</p>
      </div>
      <p class="gig-summary">${escapeHtml(gig.summary)}</p>
      <div class="tag-row">
        ${(gig.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <div class="gig-rail">
        <div class="rail-item">
          <span>起步价</span>
          <strong>${escapeHtml(gig.priceFrom)}</strong>
        </div>
        <div class="rail-item">
          <span>标准交付</span>
          <strong>${escapeHtml(gig.deliveryWindow)}</strong>
        </div>
        <div class="rail-item">
          <span>适合场景</span>
          <strong>${escapeHtml(gig.bestFor)}</strong>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      state.selectedGigId = gig.id;
      renderGigGrid();
      renderGigDetail();
    });

    elements.gigGrid.appendChild(card);
  });
}

function renderGigDetail() {
  const gig = state.gigs.find((item) => item.id === state.selectedGigId);
  if (!gig) {
    elements.gigDetail.removeAttribute("data-tone");
    elements.gigDetail.innerHTML = `<div class="empty-state">请选择一个服务，右侧会显示它的交付方式、套餐梯度和平台信任机制。</div>`;
    return;
  }

  elements.gigDetail.dataset.tone = toneForCategory(gig.category);
  elements.gigDetail.innerHTML = `
    <div class="detail-topline">
      <span class="tag">${escapeHtml(gig.categoryLabel)}</span>
      <span class="trust-badge">${escapeHtml(gig.level)}</span>
    </div>
    <div>
      <h3>${escapeHtml(gig.title)}</h3>
      <p class="detail-meta">${escapeHtml(gig.seller)} · ${escapeHtml(gig.city)} · ${escapeHtml(gig.rating)} · ${escapeHtml(gig.completed)}</p>
    </div>

    <div class="detail-block">
      <strong>服务摘要</strong>
      <p class="detail-copy">${escapeHtml(gig.detail)}</p>
    </div>

    <div class="detail-scan-grid">
      <article class="detail-scan-card">
        <span>交付周期</span>
        <strong>${escapeHtml(gig.deliveryWindow)}</strong>
      </article>
      <article class="detail-scan-card">
        <span>价格起点</span>
        <strong>${escapeHtml(gig.priceFrom)}</strong>
      </article>
      <article class="detail-scan-card">
        <span>适合场景</span>
        <strong>${escapeHtml(gig.bestFor)}</strong>
      </article>
    </div>

    <div class="detail-block">
      <strong>交付物</strong>
      <ul class="deliverable-list">
        ${(gig.deliverables || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>

    <div class="detail-block">
      <strong>套餐设计</strong>
      <div class="package-grid">
        ${(gig.packages || [])
          .map(
            (pkg, index) => `
            <article class="package-card${index === 1 ? " featured" : ""}">
              <span class="package-tier">${escapeHtml(pkg.name)}</span>
              <strong class="package-price">${escapeHtml(pkg.price)}</strong>
              <p class="package-note">${escapeHtml(pkg.note)}</p>
            </article>
          `,
          )
          .join("")}
      </div>
    </div>

    <div class="detail-block">
      <strong>平台信任机制</strong>
      <div class="trust-row">
        ${(gig.trustBadges || []).map((item) => `<span class="trust-badge">${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>

    <div class="detail-block">
      <strong>为什么这类服务适合优先做</strong>
      <p class="detail-copy">${escapeHtml(gig.whyNow)}</p>
    </div>
  `;
}

function renderWorkspaceTabs(workspaces) {
  elements.workspaceSwitcher.innerHTML = "";

  Object.entries(workspaces).forEach(([key, item], index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = `workspace-tab${state.activeRole === key ? " active" : ""}`;
    tab.dataset.tone = toneForIndex(index + 1);
    tab.innerHTML = `
      <div class="workspace-tab-row">
        <strong>${escapeHtml(item.label)}</strong>
      </div>
      <span>${escapeHtml(item.tabSummary)}</span>
    `;

    tab.addEventListener("click", () => {
      state.activeRole = key;
      renderWorkspaceTabs(workspaces);
      renderWorkspace();
    });

    elements.workspaceSwitcher.appendChild(tab);
  });
}

function renderWorkspace() {
  const workspace = state.bootstrap?.workspaces?.[state.activeRole];
  if (!workspace) {
    return;
  }

  elements.workspacePanel.dataset.tone = state.activeRole === "buyer" ? "cyan" : "lime";
  elements.workspacePanel.innerHTML = `
    <div>
      <h3>${escapeHtml(workspace.title)}</h3>
      <p class="panel-subtitle">${escapeHtml(workspace.summary)}</p>
    </div>

    <div class="metric-grid">
      ${(workspace.metrics || [])
        .map(
          (metric, index) => `
          <article class="metric-card" data-tone="${toneForIndex(index + (state.activeRole === "buyer" ? 0 : 2))}">
            <span class="metric-label">${escapeHtml(metric.label)}</span>
            <strong class="metric-value">${escapeHtml(metric.value)}</strong>
            <p class="metric-note">${escapeHtml(metric.note)}</p>
          </article>
        `,
        )
        .join("")}
    </div>

    <div class="detail-block">
      <strong>当前阶段最重要的动作</strong>
      <ul class="checklist">
        ${(workspace.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>

    <div class="detail-block">
      <strong>样例订单视图</strong>
      <div class="timeline-list">
        ${(workspace.orders || [])
          .map(
            (order, index) => `
            <article class="order-card" data-tone="${toneForIndex(index + 1)}">
              <div class="order-top">
                <div>
                  <h4>${escapeHtml(order.title)}</h4>
                  <p class="detail-meta">${escapeHtml(order.counterparty)}</p>
                </div>
                <span class="stage-chip">${escapeHtml(order.stage)}</span>
              </div>
              <p class="brief-copy">${escapeHtml(order.copy)}</p>
              <div class="brief-meta">
                <span>${escapeHtml(order.amount)}</span>
                <span>${escapeHtml(order.deadline)}</span>
              </div>
            </article>
          `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderBriefs(items) {
  elements.briefList.innerHTML = "";

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "brief-card";
    card.dataset.tone = toneForIndex(index + 2);
    card.innerHTML = `
      <div class="brief-top">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p class="brief-copy">${escapeHtml(item.summary)}</p>
        </div>
        <span class="brief-budget">${escapeHtml(item.budget)}</span>
      </div>
      <div class="brief-meta">
        <span>${escapeHtml(item.deadline)}</span>
        <span>${escapeHtml(item.mode)}</span>
        <span>${escapeHtml(item.stage)}</span>
      </div>
      <div class="tag-row">
        ${(item.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
      </div>
    `;
    elements.briefList.appendChild(card);
  });
}

function renderFlow(items) {
  elements.flowGrid.innerHTML = "";

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "flow-card";
    card.dataset.tone = toneForIndex(index);
    card.innerHTML = `
      <span class="flow-step">${escapeHtml(item.step)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.copy)}</p>
      <span class="trust-badge">${escapeHtml(item.riskControl)}</span>
    `;
    elements.flowGrid.appendChild(card);
  });
}

function renderRoadmap(items) {
  elements.roadmapGrid.innerHTML = "";

  items.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "roadmap-card";
    card.dataset.tone = toneForIndex(index + 1);
    card.innerHTML = `
      <span class="roadmap-step">${escapeHtml(item.phase)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.copy)}</p>
      <ul class="roadmap-bullets">
        ${(item.items || []).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
      </ul>
    `;
    elements.roadmapGrid.appendChild(card);
  });
}

function toneForCategory(categoryId) {
  return CATEGORY_TONES[categoryId] || "cyan";
}

function toneForIndex(index) {
  return TONE_SEQUENCE[index % TONE_SEQUENCE.length];
}

function setupMotion() {
  syncMotionTargets();
  if (motionBound) {
    return;
  }

  motionBound = true;
  window.addEventListener("scroll", requestMotionUpdate, { passive: true });
  window.addEventListener("resize", requestMotionUpdate);
}

function syncMotionTargets() {
  motionTargets = [
    ...document.querySelectorAll(
      ".section, .insight-card, .category-chip, .gig-card, .gig-detail, .workspace-panel, .brief-card, .flow-card, .roadmap-card, .metric-card, .order-card",
    ),
  ];
  requestMotionUpdate();
}

function requestMotionUpdate() {
  if (motionFrame) {
    return;
  }

  motionFrame = window.requestAnimationFrame(() => {
    motionFrame = null;
    updateMotionScene();
  });
}

function updateMotionScene() {
  const viewport = window.innerHeight || 1;
  const scroll = window.scrollY || 0;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - viewport);

  document.documentElement.style.setProperty("--page-scroll", `${scroll.toFixed(1)}px`);
  document.documentElement.style.setProperty("--page-progress", (scroll / maxScroll).toFixed(4));

  motionTargets.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const start = viewport * 0.9;
    const end = -rect.height * 0.25;
    const raw = (start - rect.top) / (start - end);
    const progress = Math.max(0, Math.min(1, raw));
    element.style.setProperty("--reveal-progress", progress.toFixed(3));
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const DEFAULT_SYMBOLS = ["NASDAQ:AAPL", "NASDAQ:NVDA", "NASDAQ:AMZN", "NASDAQ:MSFT", "NASDAQ:GOOGL"];
const LEGACY_DEFAULT_SYMBOLS = [
  "NASDAQ:NVDA",
  "NASDAQ:AAPL",
  "NASDAQ:MSFT",
  "AMEX:SPY",
  "NASDAQ:TSLA",
  "HKEX:700",
  "SSE:600519",
];
const WATCHLIST_VERSION = "default-largecaps-2026-06-25";
const MAX_COMPARE_SYMBOLS = 4;
const SYMBOL_ALIASES = {
  GOOGLE: "GOOGL",
};
const LOGO_DOMAINS = {
  AAPL: "apple.com",
  AMZN: "amazon.com",
  GOOGL: "google.com",
  GOOG: "google.com",
  META: "meta.com",
  MSFT: "microsoft.com",
  NVDA: "nvidia.com",
  SPCX: "spacex.com",
  TSLA: "tesla.com",
  XE: "x-energy.com",
};

const PIN_SVG = `<svg class="pin-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5" /><path d="M9 10.76V5h6v5.76a4 4 0 0 0 .9 2.54L17 15H7l1.1-1.7a4 4 0 0 0 .9-2.54Z" /></svg>`;

const STORAGE_KEYS = {
  symbols: "stockDesk.symbols",
  active: "stockDesk.activeSymbol",
  compare: "stockDesk.compareSymbols",
  interval: "stockDesk.interval",
  journal: "stockDesk.journal",
  sidebarCollapsed: "stockDesk.sidebarCollapsed",
  compareCollapsed: "stockDesk.compareCollapsed",
  version: "stockDesk.watchlistVersion",
};

const savedSymbols = loadJson(STORAGE_KEYS.symbols, null);
const savedVersion = localStorage.getItem(STORAGE_KEYS.version);
const initialSymbols = resolveInitialSymbols(savedSymbols, savedVersion);
const savedActiveSymbol = normalizeSymbol(localStorage.getItem(STORAGE_KEYS.active) || DEFAULT_SYMBOLS[0]);

const state = {
  symbols: initialSymbols,
  activeSymbol: initialSymbols.includes(savedActiveSymbol) ? savedActiveSymbol : initialSymbols[0],
  compareSymbols: sanitizeSymbolList(loadJson(STORAGE_KEYS.compare, DEFAULT_SYMBOLS))
    .filter((symbol) => initialSymbols.includes(symbol))
    .slice(0, MAX_COMPARE_SYMBOLS),
  interval: localStorage.getItem(STORAGE_KEYS.interval) || "60",
  journal: loadJson(STORAGE_KEYS.journal, []),
  sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1",
  compareCollapsed: localStorage.getItem(STORAGE_KEYS.compareCollapsed) !== "0",
};

const els = {
  activeSymbol: document.querySelector("#activeSymbol"),
  clearJournal: document.querySelector("#clearJournal"),
  compareCount: document.querySelector("#compareCount"),
  compareGrid: document.querySelector("#compareGrid"),
  compareSection: document.querySelector(".compare-section"),
  compareToggle: document.querySelector("#compareToggle"),
  dateText: document.querySelector("#dateText"),
  intervalSelect: document.querySelector("#intervalSelect"),
  journalForm: document.querySelector("#journalForm"),
  journalList: document.querySelector("#journalList"),
  journalNote: document.querySelector("#journalNote"),
  journalSide: document.querySelector("#journalSide"),
  journalSymbol: document.querySelector("#journalSymbol"),
  mainChart: document.querySelector("#mainChart"),
  marketOverview: document.querySelector("#marketOverview"),
  openTradingView: document.querySelector("#openTradingView"),
  researchLinks: document.querySelector("#researchLinks"),
  appLayout: document.querySelector("#appLayout"),
  sidebar: document.querySelector("#sidebar"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  symbolForm: document.querySelector("#symbolForm"),
  symbolInput: document.querySelector("#symbolInput"),
  timeText: document.querySelector("#timeText"),
  watchlist: document.querySelector("#watchlist"),
};

init();

async function init() {
  if (!state.symbols.includes(state.activeSymbol)) {
    state.activeSymbol = state.symbols[0] || DEFAULT_SYMBOLS[0];
  }

  els.intervalSelect.value = state.interval;
  persistSymbols();
  bindEvents();
  updateClock();
  setInterval(updateClock, 1000);
  renderAll();
}

function bindEvents() {
  els.sidebarToggle.addEventListener("click", () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, state.sidebarCollapsed ? "1" : "0");
    renderShell();
  });

  els.compareToggle.addEventListener("click", () => {
    state.compareCollapsed = !state.compareCollapsed;
    localStorage.setItem(STORAGE_KEYS.compareCollapsed, state.compareCollapsed ? "1" : "0");
    renderCompareShell();
    renderCompareCharts();
  });

  els.symbolForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const symbol = normalizeSymbol(els.symbolInput.value);
    if (!symbol) return;

    if (!state.symbols.includes(symbol)) {
      state.symbols.unshift(symbol);
    }

    setActiveSymbol(symbol);
    if (!state.compareSymbols.includes(symbol)) {
      state.compareSymbols = [symbol, ...state.compareSymbols].slice(0, MAX_COMPARE_SYMBOLS);
    }
    els.symbolInput.value = "";
    persistSymbols();
    renderAll();
  });

  els.intervalSelect.addEventListener("change", async () => {
    state.interval = els.intervalSelect.value;
    localStorage.setItem(STORAGE_KEYS.interval, state.interval);
    renderAll();
  });

  els.openTradingView?.addEventListener("click", () => {
    window.open(tradingViewUrl(state.activeSymbol), "_blank", "noopener,noreferrer");
  });

  els.clearJournal.addEventListener("click", () => {
    state.journal = [];
    localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(state.journal));
    renderJournal();
  });

  els.journalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = els.journalNote.value.trim();
    const symbol = normalizeSymbol(els.journalSymbol.value || state.activeSymbol);
    if (!note) return;

    state.journal.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      at: new Date().toISOString(),
      side: els.journalSide.value,
      symbol,
      note,
    });

    els.journalSymbol.value = symbol;
    els.journalNote.value = "";
    localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(state.journal));
    renderJournal();
  });

}

function renderAll() {
  renderShell();
  renderSymbolLabel(els.activeSymbol, state.activeSymbol, "active-symbol-logo");
  els.activeSymbol.title = state.activeSymbol;
  els.journalSymbol.value = displaySymbol(state.activeSymbol);
  localStorage.setItem(STORAGE_KEYS.active, state.activeSymbol);
  renderWatchlist();
  renderCompareCharts();
  renderMainChart();
  renderResearchLinks();
  renderMarketOverview();
  renderJournal();
}

function renderShell() {
  els.appLayout.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  els.sidebar.classList.toggle("collapsed", state.sidebarCollapsed);
  const label = state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  els.sidebarToggle.setAttribute("aria-label", label);
  els.sidebarToggle.title = label;
  els.sidebarToggle.classList.toggle("is-collapsed", state.sidebarCollapsed);
  renderCompareShell();
}

function renderCompareShell() {
  els.compareSection.classList.toggle("collapsed", state.compareCollapsed);
  els.compareToggle.textContent = state.compareCollapsed ? "Show" : "Hide";
  els.compareToggle.setAttribute("aria-expanded", String(!state.compareCollapsed));
  els.compareToggle.title = state.compareCollapsed ? "Show compare charts" : "Hide compare charts";
}

function renderWatchlist() {
  els.watchlist.innerHTML = "";

  state.symbols.forEach((symbol) => {
    const row = document.createElement("div");
    row.className = "symbol-item";

    const select = document.createElement("button");
    select.type = "button";
    select.className = `symbol-button${symbol === state.activeSymbol ? " active" : ""}`;
    renderSymbolLabel(select, symbol, "symbol-logo");
    select.setAttribute("aria-label", `Focus ${displaySymbol(symbol)}`);
    select.title = `Focus ${symbol}`;
    select.addEventListener("click", () => {
      setActiveSymbol(symbol);
      persistSymbols();
      renderAll();
    });

    const compare = document.createElement("button");
    compare.type = "button";
    const pinned = state.compareSymbols.includes(symbol);
    compare.className = `compare-toggle icon-btn${pinned ? " selected" : ""}`;
    compare.innerHTML = PIN_SVG;
    compare.setAttribute("aria-label", `${pinned ? "Unpin" : "Pin"} ${displaySymbol(symbol)}`);
    compare.title = `${pinned ? "Unpin" : "Pin"} ${displaySymbol(symbol)}`;
    compare.addEventListener("click", () => {
      toggleCompareSymbol(symbol);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-symbol icon-button";
    remove.textContent = "×";
    remove.disabled = state.symbols.length <= 1;
    remove.setAttribute("aria-label", `Remove ${displaySymbol(symbol)}`);
    remove.title = state.symbols.length <= 1 ? "Keep at least one symbol" : `Remove ${symbol}`;
    remove.addEventListener("click", () => {
      if (state.symbols.length <= 1) return;
      state.symbols = state.symbols.filter((item) => item !== symbol);
      state.compareSymbols = state.compareSymbols.filter((item) => item !== symbol);
      if (state.activeSymbol === symbol) {
        setActiveSymbol(state.symbols[0] || DEFAULT_SYMBOLS[0]);
      }
      persistSymbols();
      renderAll();
    });

    row.append(select, compare, remove);
    els.watchlist.append(row);
  });
}

function toggleCompareSymbol(symbol) {
  if (state.compareSymbols.includes(symbol)) {
    state.compareSymbols = state.compareSymbols.filter((item) => item !== symbol);
  } else if (state.compareSymbols.length >= MAX_COMPARE_SYMBOLS) {
    state.compareSymbols = [...state.compareSymbols.slice(1), symbol];
  } else {
    state.compareSymbols = [...state.compareSymbols, symbol];
  }

  persistSymbols();
  renderAll();
}

function renderMainChart() {
  renderSymbolLabel(els.activeSymbol, state.activeSymbol, "active-symbol-logo");
  els.activeSymbol.title = state.activeSymbol;
  mountTradingViewWidget(els.mainChart, "embed-widget-advanced-chart.js", {
    autosize: true,
    symbol: state.activeSymbol,
    interval: tradingViewInterval(state.interval),
    timezone: "Europe/London",
    theme: "dark",
    style: "1",
    locale: "en",
    backgroundColor: "rgba(8, 13, 22, 1)",
    gridColor: "rgba(129, 161, 193, 0.16)",
    allow_symbol_change: true,
    calendar: false,
    hide_side_toolbar: false,
    details: true,
    hotlist: false,
    show_popup_button: true,
    popup_width: "1200",
    popup_height: "720",
    support_host: "https://www.tradingview.com",
  });
}

function renderCompareCharts() {
  els.compareGrid.innerHTML = "";
  const selected = state.compareSymbols.slice(0, MAX_COMPARE_SYMBOLS);
  els.compareCount.textContent = String(selected.length);

  if (!selected.length) {
    els.compareSection.hidden = true;
    return;
  }

  els.compareSection.hidden = false;
  els.compareGrid.className = `compare-grid count-${selected.length}`;
  if (state.compareCollapsed) {
    els.compareGrid.innerHTML = `
      <div class="compare-summary">
        ${selected.map((symbol) => `<span>${escapeHtml(displaySymbol(symbol))}</span>`).join("")}
      </div>
    `;
    return;
  }

  selected.forEach((symbol) => {
    const card = document.createElement("article");
    card.className = "tradingview-chart-card compare";

    const header = document.createElement("header");
    const title = document.createElement("button");
    title.type = "button";
    title.className = "compare-symbol";
    renderSymbolLabel(title, symbol, "compare-symbol-logo");
    title.title = `Focus ${symbol}`;
    title.addEventListener("click", () => {
      setActiveSymbol(symbol);
      persistSymbols();
      renderAll();
    });

    const open = document.createElement("a");
    open.href = tradingViewUrl(symbol);
    open.target = "_blank";
    open.rel = "noreferrer";
    open.className = "chart-open-link";
    open.textContent = "↗";
    open.setAttribute("aria-label", `Open ${displaySymbol(symbol)} in TradingView`);
    open.title = `Open ${displaySymbol(symbol)} in TradingView`;

    const body = document.createElement("div");
    body.className = "tradingview-chart-body";

    header.append(title, open);
    card.append(header, body);
    els.compareGrid.append(card);
    mountTradingViewWidget(body, "embed-widget-advanced-chart.js", {
      autosize: true,
      symbol,
      interval: tradingViewInterval(state.interval),
      timezone: "Europe/London",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(8, 13, 22, 1)",
      gridColor: "rgba(129, 161, 193, 0.16)",
      allow_symbol_change: false,
      calendar: false,
      hide_side_toolbar: false,
      details: false,
      hotlist: false,
      show_popup_button: true,
      popup_width: "1200",
      popup_height: "720",
      support_host: "https://www.tradingview.com",
    });
  });

}

function renderResearchLinks() {
  const ticker = toTicker(state.activeSymbol);
  const encodedSymbol = encodeURIComponent(state.activeSymbol);
  const encodedTicker = encodeURIComponent(ticker);
  const links = [
    ["TradingView", tradingViewUrl(state.activeSymbol)],
    ["Yahoo Finance", `https://finance.yahoo.com/quote/${encodedTicker}`],
    ["Nasdaq", `https://www.nasdaq.com/market-activity/stocks/${encodeURIComponent(ticker.toLowerCase())}`],
    ["Google Finance", `https://www.google.com/finance/quote/${encodedSymbol}`],
    ["SEC Filings", `https://www.sec.gov/edgar/search/#/q=${encodedTicker}`],
  ];

  els.researchLinks.innerHTML = links
    .map(
      ([label, href]) => `
        <a href="${href}" target="_blank" rel="noreferrer">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(ticker)}</span>
        </a>
      `,
    )
    .join("");
}

function renderMarketOverview() {
  mountTradingViewWidget(els.marketOverview, "embed-widget-market-overview.js", {
    colorTheme: "dark",
    dateRange: "12M",
    showChart: true,
    locale: "en",
    largeChartUrl: "",
    isTransparent: true,
    showSymbolLogo: true,
    showFloatingTooltip: false,
    width: "100%",
    height: "100%",
    plotLineColorGrowing: "rgba(45, 212, 191, 1)",
    plotLineColorFalling: "rgba(251, 113, 133, 1)",
    gridLineColor: "rgba(129, 161, 193, 0.18)",
    tabs: [
      {
        title: "Indices",
        symbols: [
          { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
          { s: "FOREXCOM:NSXUSD", d: "Nasdaq 100" },
          { s: "FOREXCOM:DJI", d: "Dow Jones" },
        ],
      },
      {
        title: "Commodities",
        symbols: [
          { s: "TVC:GOLD", d: "Gold" },
          { s: "NYMEX:CL1!", d: "Crude Oil" },
          { s: "TVC:DXY", d: "US Dollar Index" },
        ],
      },
    ],
  });
}

function renderJournal() {
  els.journalList.innerHTML = "";

  if (!state.journal.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No journal notes yet.";
    els.journalList.append(empty);
    return;
  }

  state.journal.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "journal-entry";

    const header = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = `${displaySymbol(entry.symbol)} · ${entry.side}`;
    const time = document.createElement("span");
    time.textContent = new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(entry.at));

    const note = document.createElement("p");
    note.textContent = entry.note;

    header.append(title, time);
    article.append(header, note);
    els.journalList.append(article);
  });
}

function mountTradingViewWidget(target, widgetFile, config) {
  target.innerHTML = "";
  const container = document.createElement("div");
  container.className = "tradingview-widget-container";
  container.style.height = "100%";
  container.style.width = "100%";

  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container__widget";
  widget.style.height = "100%";
  widget.style.width = "100%";

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = `https://s3.tradingview.com/external-embedding/${widgetFile}`;
  script.async = true;
  script.textContent = JSON.stringify(config);

  container.append(widget, script);
  target.append(container);
}

function normalizeSymbol(value) {
  const raw = String(value || "").trim().replace(/\s+/g, "").toUpperCase();
  if (!raw) return "";
  const [exchange, ticker] = raw.includes(":") ? raw.split(":") : ["NASDAQ", raw];
  return `${exchange}:${canonicalTicker(ticker)}`;
}

function toTicker(symbol) {
  return canonicalTicker(symbol.split(":").pop());
}

function displaySymbol(symbol) {
  return toTicker(symbol);
}

function renderSymbolLabel(target, symbol, logoClass) {
  target.textContent = "";
  const ticker = displaySymbol(symbol);
  const logo = createLogoElement(symbol, logoClass);
  const text = document.createElement("span");
  text.className = "symbol-label-text";
  text.textContent = ticker;
  target.append(logo, text);
}

function createLogoElement(symbol, className) {
  const ticker = toTicker(symbol);
  const domain = LOGO_DOMAINS[ticker];
  const fallback = document.createElement("span");
  fallback.className = `${className} logo-fallback`;
  fallback.textContent = ticker.slice(0, 1);

  if (!domain) return fallback;

  const image = document.createElement("img");
  image.className = className;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  image.addEventListener("error", () => image.replaceWith(fallback), { once: true });
  return image;
}

function canonicalTicker(ticker) {
  const upper = String(ticker || "").toUpperCase();
  return SYMBOL_ALIASES[upper] || upper;
}

function uniqueSymbols(symbols) {
  return [...new Set(symbols.filter(Boolean))];
}

function sanitizeSymbolList(symbols) {
  if (!Array.isArray(symbols)) return [...DEFAULT_SYMBOLS];
  return uniqueSymbols(symbols.map(normalizeSymbol).filter(Boolean));
}

function setActiveSymbol(symbol) {
  state.activeSymbol = symbol;
}

function persistSymbols() {
  localStorage.setItem(STORAGE_KEYS.symbols, JSON.stringify(state.symbols));
  localStorage.setItem(STORAGE_KEYS.active, state.activeSymbol);
  localStorage.setItem(STORAGE_KEYS.compare, JSON.stringify(state.compareSymbols.slice(0, MAX_COMPARE_SYMBOLS)));
  localStorage.setItem(STORAGE_KEYS.version, WATCHLIST_VERSION);
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function resolveInitialSymbols(saved, version) {
  // Seed defaults only on first run or after a WATCHLIST_VERSION bump. During
  // normal use, respect the saved list exactly so the user's additions and
  // removals persist — defaults are never silently re-injected.
  if (version !== WATCHLIST_VERSION || !Array.isArray(saved) || arraysEqual(saved, LEGACY_DEFAULT_SYMBOLS)) {
    return [...DEFAULT_SYMBOLS];
  }

  const sanitized = sanitizeSymbolList(saved);
  return sanitized.length ? sanitized : [...DEFAULT_SYMBOLS];
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function tradingViewUrl(symbol) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
}

function tradingViewInterval(interval) {
  const map = {
    "1": "1",
    "5": "5",
    "15": "15",
    "60": "60",
    D: "D",
    W: "W",
  };
  return map[interval] || "60";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function updateClock() {
  const now = new Date();
  els.dateText.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  els.timeText.textContent = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
}

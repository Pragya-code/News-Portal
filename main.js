// ===== CONFIG =====
const API_KEY = "NxwAVPiNyt9-Z0d6FSnxh03iLDN88VuWPs0XF7efjltdlDLE";
const BASE_URL = "https://api.currentsapi.services/v1/latest-news";
const SEARCH_URL = "https://api.currentsapi.services/v1/search";
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

const NEPAL_FEEDS = [
  { url: "https://kathmandupost.com/feed", source: "Kathmandu Post" },
  { url: "https://myrepublica.nagariknetwork.com/feed", source: "MyRepublica" },
  { url: "https://english.onlinekhabar.com/feed", source: "OnlineKhabar" },
];

// ===== STATE =====
let savedNews = JSON.parse(localStorage.getItem("savedNews") || "[]");
let currentView = "home";
let currentCategory = "";
let currentRegion = "";
let allNews = {};
let categoryPage = {};

// ===== CACHE HELPERS =====
const CACHE_TTL = 30 * 60 * 1000;
function getCached(key) {
  try {
    const raw = localStorage.getItem("nc_" + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem("nc_" + key); return null; }
    return data;
  } catch { return null; }
}
function setCached(key, data) {
  try { localStorage.setItem("nc_" + key, JSON.stringify({ ts: Date.now(), data })); }
  catch { clearNewsCaches(); try { localStorage.setItem("nc_" + key, JSON.stringify({ ts: Date.now(), data })); } catch {} }
}
function clearNewsCaches() {
  Object.keys(localStorage).filter(k => k.startsWith("nc_")).forEach(k => localStorage.removeItem(k));
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ===== CATEGORIES =====
const CATEGORIES = [
  { key: "business",           label: "Business",             icon: "fa-briefcase", apiKey: "business" },
  { key: "politics",           label: "Politics",             icon: "fa-landmark",  apiKey: "politics" },
  { key: "sports",             label: "Sports",               icon: "fa-futbol",    apiKey: "sports" },
  { key: "entertainment",      label: "Entertainment",        icon: "fa-film",      apiKey: "entertainment" },
  { key: "health",             label: "Health",               icon: "fa-heartbeat", apiKey: "health" },
  { key: "science_technology", label: "Science & Technology", icon: "fa-microchip", apiKey: "technology" },
];

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  updateSavedBadge();
  buildSidebarCategories();
  setupEventListeners();
  populateCalendar();
  showHomeView();
});

// ===== CALENDAR =====
function populateCalendar() {
  const now = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const g = id => document.getElementById(id);
  if (g("calDayName"))   g("calDayName").textContent   = days[now.getDay()];
  if (g("calDayNum"))    g("calDayNum").textContent    = String(now.getDate()).padStart(2, "0");
  if (g("calMonthYear")) g("calMonthYear").textContent = months[now.getMonth()] + " " + now.getFullYear();
}

// ===== NEPAL RSS =====
async function fetchNepalRSS(feedObj) {
  const cacheKey = "nepal_" + feedObj.source.replace(/\s/g, "_");
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(RSS2JSON + encodeURIComponent(feedObj.url) + "&count=20");
    const data = await res.json();
    if (data.status !== "ok") return [];
    const articles = (data.items || []).map(item => ({
      title: item.title || "",
      description: item.description ? item.description.replace(/<[^>]*>/g, "").slice(0, 200) : "",
      link: item.link || "",
      image_url: item.enclosure?.link || item.thumbnail || null,
      pubDate: item.pubDate || "",
      category: ["National"],
      source: feedObj.source,
      isNepal: true,
    }));
    setCached(cacheKey, articles);
    setCached(cacheKey + "_stale", articles);
    return articles;
  } catch (e) {
    console.error("[DevNews] RSS failed:", feedObj.source, e.message);
    return getCached(cacheKey + "_stale") || [];
  }
}

async function fetchAllNepalNews() {
  const cacheKey = "nepal_all";
  const cached = getCached(cacheKey);
  if (cached) return shuffle(cached);
  const results = await Promise.all(NEPAL_FEEDS.map(f => fetchNepalRSS(f)));
  const seen = new Set();
  const combined = results.flat().filter(a => {
    if (!a.link || seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
  setCached(cacheKey, combined);
  return shuffle(combined);
}

// ===== CURRENTS API =====
async function fetchNews(apiCategory = "", page = 1) {
  const cacheKey = "currents_" + (apiCategory || "top") + "_" + page;
  if (allNews[cacheKey]) return shuffle(allNews[cacheKey]);
  const cached = getCached(cacheKey);
  if (cached) { allNews[cacheKey] = cached; return shuffle(cached); }

  let url = BASE_URL + "?apiKey=" + API_KEY + "&language=en&page_size=20";
  if (apiCategory) url += "&category=" + apiCategory;
  if (page > 1) url += "&page_number=" + page;
  console.log("[DevNews] Fetching:", apiCategory || "top");

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "ok") {
      showFetchError(data.message || "API error.");
      const stale = getCached(cacheKey + "_stale");
      return stale ? shuffle(stale) : [];
    }
    const results = (data.news || []).map(a => ({
      title: a.title,
      description: a.description,
      link: a.url,
      image_url: a.image && a.image !== "None" ? a.image : null,
      pubDate: a.published,
      category: Array.isArray(a.category) ? a.category : [a.category],
      source: "International",
      isNepal: false,
    }));
    allNews[cacheKey] = results;
    setCached(cacheKey, results);
    setCached(cacheKey + "_stale", results);
    return shuffle(results);
  } catch (e) {
    showFetchError("Network error — check your connection.");
    const stale = getCached(cacheKey + "_stale");
    return stale ? shuffle(stale) : [];
  }
}

function showFetchError(msg) {
  if (document.getElementById("fetchErrorBanner")) return;
  const b = document.createElement("div");
  b.id = "fetchErrorBanner";
  b.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#b71c1c;color:white;padding:10px 24px 10px 16px;border-radius:8px;font-size:0.85rem;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);max-width:90vw;text-align:center;";
  b.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:8px;"></i>' + msg +
    '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;margin-left:12px;font-size:1rem;">✕</button>';
  document.body.appendChild(b);
  setTimeout(() => b?.remove(), 8000);
}

// ===== VIEW ROUTER =====
function showView(view) {
  ["home", "category", "saved", "search"].forEach(v => {
    const el = document.getElementById(v + "View");
    if (el) el.style.display = "none";
  });
  const hero = document.getElementById("heroSection");
  const header = document.getElementById("mainHeader");
  if (hero) hero.style.display = "none";
  if (header) header.style.display = "none";

  const target = document.getElementById(view + "View");
  if (target) target.style.display = "block";

  if (view === "home") {
    if (hero) hero.style.display = "flex";
    if (header) header.style.display = "block";
  }
  currentView = view;
  const nav = document.getElementById("mainNav");
  window.scrollTo({ top: nav ? nav.offsetTop - 10 : 0, behavior: "smooth" });
}

// ===== HOME VIEW =====
async function showHomeView() {
  showView("home");
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  document.querySelector('[data-category="home"]')?.classList.add("active");
  updateRegionLabel();

  const breakingGrid = document.getElementById("breakingNewsGrid");
  if (breakingGrid) breakingGrid.innerHTML = '<div class="loader-wrap"><div class="loader"></div></div>';

  const topNews = currentRegion === "national"
    ? await fetchAllNepalNews()
    : await fetchNews("");

  renderBreakingNews(topNews.slice(0, 5));
  updateTicker(topNews.slice(0, 10));

  const sectionsEl = document.getElementById("categorySections");
  if (!sectionsEl) return;
  sectionsEl.innerHTML = "";

  if (currentRegion === "national") {
    const section = document.createElement("div");
    section.className = "section-block category-section";
    section.innerHTML = `
      <div class="section-header">
        <h2><span class="accent-line"></span>🇳🇵 Nepal News
          <a href="#" id="nepalViewAll" style="font-size:0.75rem;margin-left:12px;color:var(--blue);font-family:Poppins,sans-serif;font-weight:600;">View All →</a>
        </h2>
      </div>
      <div class="news-grid" id="catGrid_nepal"><div class="loader-wrap"><div class="loader"></div></div></div>`;
    sectionsEl.appendChild(section);
    section.querySelector("#nepalViewAll").addEventListener("click", e => { e.preventDefault(); showNepalView(); });
    const nepal = await fetchAllNepalNews();
    const g = document.getElementById("catGrid_nepal");
    if (g) renderNewsGrid(nepal.slice(0, 6), g);
    return;
  }

  // International categories
  for (const cat of CATEGORIES) {
    const section = document.createElement("div");
    section.className = "section-block category-section";
    section.innerHTML = `
      <div class="section-header">
        <h2>
          <span class="accent-line"></span>
          <i class="fas ${cat.icon}" style="color:var(--red);margin-right:8px;"></i>${cat.label}
          <a href="#" data-category="${cat.key}" style="font-size:0.75rem;margin-left:12px;color:var(--blue);font-family:Poppins,sans-serif;font-weight:600;">View All →</a>
        </h2>
      </div>
      <div class="news-grid" id="catGrid_${cat.key}"><div class="loader-wrap"><div class="loader"></div></div></div>`;
    sectionsEl.appendChild(section);
    section.querySelector('[data-category="' + cat.key + '"]').addEventListener("click", e => {
      e.preventDefault();
      showCategoryView(cat.key);
    });
    (async (c) => {
      const news = await fetchNews(c.apiKey);
      const g = document.getElementById("catGrid_" + c.key);
      if (g) renderNewsGrid(news.slice(0, 6), g);
    })(cat);
  }
}

// ===== NEPAL VIEW =====
async function showNepalView() {
  showView("category");
  currentCategory = "nepal";
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  const header = document.getElementById("categoryPageHeader");
  if (header) header.innerHTML = '<h2><span class="accent-line"></span>🇳🇵 Nepal News</h2>';
  const grid = document.getElementById("categoryNewsGrid");
  if (grid) grid.innerHTML = '<div class="loader-wrap"><div class="loader"></div></div>';
  const news = await fetchAllNepalNews();
  if (grid) renderNewsGrid(news, grid);
  buildSidebarTrending(news);
  const btn = document.getElementById("loadMoreBtn");
  if (btn) btn.style.display = "none";
}

// ===== RENDER BREAKING NEWS =====
// Layout:
//   [ BIG CARD (left, square/horizontal) ] [ Small Card A (top-right) ]
//   [                                     ] [ Small Card B (bot-right) ]
//   [ Small Card C ] [ Small Card D ]  ← bottom row, under big card only
function renderBreakingNews(articles) {
  const grid = document.getElementById("breakingNewsGrid");
  if (!grid) return;
  if (!articles.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:40px;">No news available. Check your connection.</p>';
    return;
  }
  grid.innerHTML = "";

  // Big featured card — col 1, row 1 (square/horizontal)
  const mainWrap = document.createElement("div");
  mainWrap.className = "featured-main";
  mainWrap.appendChild(createCard(articles[0], true));
  grid.appendChild(mainWrap);

  // Right column — 2 cards stacked vertically beside the big card
  const rightCol = document.createElement("div");
  rightCol.className = "featured-right-col";
  [articles[1], articles[2]].filter(Boolean).forEach(a => rightCol.appendChild(createCard(a, false)));
  grid.appendChild(rightCol);

  // Bottom row — 2 cards side by side below the big card
  const bottomArticles = [articles[3], articles[4]].filter(Boolean);
  if (bottomArticles.length) {
    const bottomRow = document.createElement("div");
    bottomRow.className = "featured-bottom-row";
    bottomArticles.forEach(a => bottomRow.appendChild(createCard(a, false)));
    grid.appendChild(bottomRow);
  }
}

// ===== RENDER GRID =====
function renderNewsGrid(articles, container) {
  container.innerHTML = "";
  if (!articles.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>No articles found.</p></div>';
    return;
  }
  articles.forEach(a => container.appendChild(createCard(a, false)));
}

// ===== CREATE CARD =====
function createCard(article, featured = false) {
  if (!article) return document.createElement("div");
  const card = document.createElement("div");
  card.className = "news-card" + (featured ? " card-featured" : "");

  const isSaved = savedNews.some(s => s.link === article.link);
  const date = article.pubDate
    ? new Date(article.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const timeAgoStr = article.pubDate ? timeAgo(article.pubDate) : date;
  const category = Array.isArray(article.category) ? article.category[0] : (article.category || "");
  const source = article.source || "";

  // Image
  if (article.image_url) {
    const img = document.createElement("img");
    img.className = "card-img";
    img.src = article.image_url;
    img.alt = article.title || "";
    img.loading = "lazy";
    img.onerror = () => img.replaceWith(makePlaceholder());
    card.appendChild(img);
  } else {
    card.appendChild(makePlaceholder());
  }

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      ${category ? '<span class="card-category">' + category + '</span>' : ""}
      ${source ? '<span class="card-source">' + source + '</span>' : ""}
    </div>
    <h3>${article.title || "No Title"}</h3>
    ${article.description ? '<p class="card-desc">' + article.description + '</p>' : ""}
    <div class="card-footer">
      <span class="card-date"><i class="fas fa-clock" style="margin-right:4px;"></i>${timeAgoStr}</span>
      <div class="card-actions">
        <button class="card-btn save-btn ${isSaved ? "saved" : ""}" title="${isSaved ? "Unsave" : "Save"}">
          <i class="fa${isSaved ? "s" : "r"} fa-bookmark"></i>
        </button>
        <a href="${article.link || "#"}" target="_blank" rel="noopener" class="card-btn" title="Open article">
          <i class="fas fa-external-link-alt"></i>
        </a>
      </div>
    </div>
    ${article.link ? '<a href="' + article.link + '" target="_blank" rel="noopener" class="card-read-more">Read more <i class="fas fa-arrow-right"></i></a>' : ""}`;

  card.appendChild(body);
  card.querySelector(".save-btn").addEventListener("click", e => {
    e.stopPropagation();
    e.preventDefault();
    toggleSave(article, e.currentTarget);
  });
  return card;
}

function makePlaceholder() {
  const ph = document.createElement("div");
  ph.className = "card-img-placeholder";
  ph.innerHTML = '<i class="fas fa-newspaper"></i>';
  return ph;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return Math.floor(diff) + "s ago";
  if (diff < 3600)  return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

// ===== CATEGORY VIEW =====
async function showCategoryView(category, region = currentRegion) {
  showView("category");
  currentCategory = category;
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  document.querySelectorAll('[data-category="' + category + '"]').forEach(l => l.classList.add("active"));

  const catObj = CATEGORIES.find(c => c.key === category);
  const header = document.getElementById("categoryPageHeader");
  if (header) header.innerHTML =
    '<h2><span class="accent-line"></span>' +
    '<i class="fas ' + (catObj?.icon || "fa-newspaper") + '" style="color:var(--red);margin-right:8px;"></i>' +
    (catObj?.label || category) + ' News</h2>';

  const grid = document.getElementById("categoryNewsGrid");
  if (grid) grid.innerHTML = '<div class="loader-wrap"><div class="loader"></div></div>';

  const news = region === "national"
    ? await fetchAllNepalNews()
    : await fetchNews(catObj?.apiKey || category);

  if (grid) renderNewsGrid(news, grid);
  buildSidebarTrending(news);
  categoryPage[category] = 1;

  const btn = document.getElementById("loadMoreBtn");
  if (btn) btn.style.display = region === "national" ? "none" : "block";
}

function buildSidebarTrending(news) {
  const el = document.getElementById("sidebarTrending");
  if (!el) return;
  el.innerHTML = "";
  news.slice(0, 5).forEach((a, i) => {
    const div = document.createElement("div");
    div.className = "sidebar-trending-item";
    const date = a.pubDate
      ? new Date(a.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    div.innerHTML =
      '<span class="trending-num">' + (i + 1) + '</span>' +
      '<div><div class="trending-title">' + (a.title || "") + '</div>' +
      '<div class="trending-date">' + date + '</div></div>';
    div.addEventListener("click", () => { if (a.link) window.open(a.link, "_blank"); });
    el.appendChild(div);
  });
}

document.getElementById("loadMoreBtn").addEventListener("click", async () => {
  const btn = document.getElementById("loadMoreBtn");
  btn.textContent = "Loading...";
  btn.disabled = true;
  categoryPage[currentCategory] = (categoryPage[currentCategory] || 1) + 1;
  const catObj = CATEGORIES.find(c => c.key === currentCategory);
  const news = await fetchNews(catObj?.apiKey || currentCategory, categoryPage[currentCategory]);
  const grid = document.getElementById("categoryNewsGrid");
  if (!news.length) {
    btn.textContent = "No more articles";
    return;
  }
  news.forEach(a => grid.appendChild(createCard(a)));
  btn.innerHTML = 'Load More <i class="fas fa-arrow-down"></i>';
  btn.disabled = false;
});

// ===== SAVED VIEW =====
function showSavedView() {
  showView("saved");
  const grid = document.getElementById("savedNewsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!savedNews.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-bookmark"></i><p>No saved articles yet.</p></div>';
    return;
  }
  savedNews.forEach(a => grid.appendChild(createCard(a)));
}

// ===== SEARCH =====
async function performSearch(query) {
  if (!query.trim()) return;
  document.getElementById("searchQueryLabel").textContent = '"' + query.trim() + '"';
  showView("search");
  const grid = document.getElementById("searchResultsGrid");
  if (grid) grid.innerHTML = '<div class="loader-wrap"><div class="loader"></div></div>';
  try {
    const url = SEARCH_URL + "?apiKey=" + API_KEY + "&keywords=" + encodeURIComponent(query.trim()) + "&language=en&page_size=20";
    const res = await fetch(url);
    const data = await res.json();
    let results = (data.news || []).map(a => ({
      title: a.title,
      description: a.description,
      link: a.url,
      image_url: a.image && a.image !== "None" ? a.image : null,
      pubDate: a.published,
      category: Array.isArray(a.category) ? a.category : [a.category],
      source: "International",
    }));
    // Also search cached Nepal news locally
    const nepalCached = getCached("nepal_all") || [];
    const q = query.trim().toLowerCase();
    const nepalMatches = nepalCached.filter(a =>
      (a.title || "").toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q));
    results = [...nepalMatches, ...results];
    if (grid) grid.innerHTML = "";
    if (!results.length) {
      if (grid) grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No results for "' + query.trim() + '"</p></div>';
      return;
    }
    results.forEach(a => grid && grid.appendChild(createCard(a)));
  } catch {
    if (grid) grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Search failed. Please try again.</p></div>';
  }
}

// ===== SAVE / UNSAVE =====
function toggleSave(article, btn) {
  const idx = savedNews.findIndex(s => s.link === article.link);
  if (idx === -1) {
    savedNews.push(article);
    btn.classList.add("saved");
    btn.title = "Unsave";
    btn.querySelector("i").className = "fas fa-bookmark";
  } else {
    savedNews.splice(idx, 1);
    btn.classList.remove("saved");
    btn.title = "Save";
    btn.querySelector("i").className = "far fa-bookmark";
  }
  localStorage.setItem("savedNews", JSON.stringify(savedNews));
  updateSavedBadge();
  if (currentView === "saved") showSavedView();
}

function updateSavedBadge() {
  const badge = document.getElementById("savedBadge");
  if (badge) badge.textContent = savedNews.length;
}

function updateTicker(articles) {
  const t = document.getElementById("breakingTicker");
  if (t && articles.length) t.textContent = articles.map(a => "🔴 " + a.title).join("   •   ");
}

function updateRegionLabel() {
  const toggle = document.querySelector(".dropdown-toggle");
  if (!toggle) return;
  toggle.innerHTML = currentRegion === "national"
    ? '🇳🇵 NATIONAL <i class="fas fa-chevron-down"></i>'
    : 'REGION <i class="fas fa-chevron-down"></i>';
}

// ===== SIDEBAR =====
function buildSidebarCategories() {
  const list = document.getElementById("sidebarCatList");
  if (!list) return;
  list.innerHTML = "";

  // Nepal link
  const nepalLi = document.createElement("li");
  nepalLi.innerHTML = '<a href="#"><span><i class="fas fa-flag"></i> Nepal News</span><i class="fas fa-chevron-right" style="font-size:0.6rem;opacity:0.5;"></i></a>';
  nepalLi.querySelector("a").addEventListener("click", e => { e.preventDefault(); showNepalView(); });
  list.appendChild(nepalLi);

  CATEGORIES.forEach(cat => {
    const li = document.createElement("li");
    li.innerHTML = '<a href="#" data-category="' + cat.key + '"><span><i class="fas ' + cat.icon + '"></i> ' + cat.label + '</span><i class="fas fa-chevron-right" style="font-size:0.6rem;opacity:0.5;"></i></a>';
    li.querySelector("a").addEventListener("click", e => { e.preventDefault(); showCategoryView(cat.key); });
    list.appendChild(li);
  });
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Nav links
  document.querySelectorAll(".nav-link[data-category]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const cat = link.dataset.category;
      if (cat === "home") showHomeView();
      else showCategoryView(cat);
      document.getElementById("navLinks").classList.remove("open");
    });
  });

  // Region dropdown
  document.querySelectorAll("[data-region]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      currentRegion = link.dataset.region === currentRegion ? "" : link.dataset.region;
      allNews = {};
      showHomeView();
      document.getElementById("navLinks").classList.remove("open");
    });
  });

  // Saved
  document.getElementById("savedBtn").addEventListener("click", () => showSavedView());

  // Dark mode
  document.getElementById("themeBtn").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    document.getElementById("themeBtn").querySelector("i").className =
      document.body.classList.contains("dark") ? "fas fa-sun" : "fas fa-moon";
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
  // Restore saved theme
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    const icon = document.getElementById("themeBtn").querySelector("i");
    if (icon) icon.className = "fas fa-sun";
  }

  // Search toggle
  document.getElementById("searchToggle").addEventListener("click", () => {
    document.getElementById("searchBox").classList.toggle("open");
    if (document.getElementById("searchBox").classList.contains("open"))
      document.getElementById("searchInput").focus();
  });
  document.getElementById("searchClose").addEventListener("click", () => {
    document.getElementById("searchBox").classList.remove("open");
    document.getElementById("searchInput").value = "";
  });
  const doSearch = () => {
    performSearch(document.getElementById("searchInput").value);
    document.getElementById("searchBox").classList.remove("open");
  };
  document.getElementById("searchSubmit").addEventListener("click", doSearch);
  document.getElementById("searchInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

  // Hamburger
  document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });

  // Contact form
  document.getElementById("contactForm").addEventListener("submit", e => {
    e.preventDefault();
    const msg = document.getElementById("formMessage");
    msg.textContent = "Thank you! Your message has been sent.";
    msg.className = "success";
    e.target.reset();
    setTimeout(() => { msg.textContent = ""; msg.className = ""; }, 4000);
  });
}
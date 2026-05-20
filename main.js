// API keys and endpoints
const API_KEY  = "NxwAVPiNyt9-Z0d6FSnxh03iLDN88VuWPs0XF7efjltdlDLE";
const BASE_URL = "https://api.currentsapi.services/v1/latest-news";
const SEARCH_URL = "https://api.currentsapi.services/v1/search";
const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";

// saved news API
const SAVED_API = "api/saved_news.php";

// ratings and comments API
const RATINGS_API  = "api/ratings.php";
const COMMENTS_API = "api/comments.php";

// unique ID for this browser — ties saved news to this device for guests
function getBrowserId() {
  let bid = localStorage.getItem("devsnews_bid");
  if (!bid) {
    bid = "bid-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("devsnews_bid", bid);
  }
  return bid;
}
const BROWSER_ID = getBrowserId();

const NEPAL_FEEDS = [
  { url: "https://kathmandupost.com/feed",              source: "Kathmandu Post" },
  { url: "https://myrepublica.nagariknetwork.com/feed", source: "MyRepublica"    },
  { url: "https://english.onlinekhabar.com/feed",       source: "OnlineKhabar"  },
];

// page state variables
let savedNews     = [];   // loaded from DB on init
let currentView   = "home";
let currentCategory = "";
let currentRegion   = "";
let allNews       = {};
let categoryPage  = {};

// simple cache so we don't re-fetch news we already have
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

// list of categories shown in the nav
const CATEGORIES = [
  { key: "business",           label: "Business",             icon: "fa-briefcase", apiKey: "business"      },
  { key: "politics",           label: "Politics",             icon: "fa-landmark",  apiKey: "politics"      },
  { key: "sports",             label: "Sports",               icon: "fa-futbol",    apiKey: "sports"        },
  { key: "entertainment",      label: "Entertainment",        icon: "fa-film",      apiKey: "entertainment" },
  { key: "health",             label: "Health",               icon: "fa-heartbeat", apiKey: "health"        },
  { key: "science_technology", label: "Science & Technology", icon: "fa-microchip", apiKey: "technology"    },
];

// runs on page load
document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedFromDB();   // Sprint 2 — load saved news from DB first
  updateSavedBadge();
  buildSidebarCategories();
  setupEventListeners();
  populateCalendar();
  showHomeView();
});

// fill in today's date in the calendar widget
function populateCalendar() {
  const now    = new Date();
  const days   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const g = id => document.getElementById(id);
  if (g("calDayName"))   g("calDayName").textContent   = days[now.getDay()];
  if (g("calDayNum"))    g("calDayNum").textContent    = String(now.getDate()).padStart(2, "0");
  if (g("calMonthYear")) g("calMonthYear").textContent = months[now.getMonth()] + " " + now.getFullYear();
}

// saved news — database functions

// Load saved news — uses user_id if logged in, browser ID if guest
async function loadSavedFromDB() {
  try {
    const uid = window.AuthState?.user?.id ? "&uid=" + window.AuthState.user.id : "";
    const res  = await fetch(SAVED_API + "?sid=" + encodeURIComponent(BROWSER_ID) + uid);
    const data = await res.json();
    if (data.success) {
      savedNews = data.data;
      console.log("[DevNews] Loaded " + savedNews.length + " saved articles from DB");
    }
  } catch (e) {
    console.warn("[DevNews] Could not load saved news from DB, falling back to localStorage:", e.message);
    // Fallback to localStorage if DB is unreachable
    savedNews = JSON.parse(localStorage.getItem("savedNews") || "[]");
  }
}

// Save article to DB
async function saveArticleToDB(article) {
  const res  = await fetch(SAVED_API, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sid:         BROWSER_ID,
      uid:         window.AuthState?.user?.id || null,
      title:       article.title       || "",
      description: article.description || "",
      link:        article.link        || "",
      image_url:   article.image_url   || "",
      source:      article.source      || "",
      category:    Array.isArray(article.category) ? article.category[0] : (article.category || ""),
      pubDate:     article.pubDate     || "",
    })
  });
  return res.json();
}

// Delete article from DB
async function deleteArticleFromDB(link) {
  const res = await fetch(SAVED_API, {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid: BROWSER_ID, uid: window.AuthState?.user?.id || null, link })
  });
  return res.json();
}

// fetch Nepal news from RSS feeds
async function fetchNepalRSS(feedObj) {
  const cacheKey = "nepal_" + feedObj.source.replace(/\s/g, "_");
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const res  = await fetch(RSS2JSON + encodeURIComponent(feedObj.url));
    const data = await res.json();
    if (data.status !== "ok") return [];
    const articles = (data.items || []).map(item => ({
      title:       item.title || "",
      description: item.description ? item.description.replace(/<[^>]*>/g, "").slice(0, 200) : "",
      link:        item.link || "",
      image_url:   item.enclosure?.link || item.thumbnail || null,
      pubDate:     item.pubDate || "",
      category:    ["National"],
      source:      feedObj.source,
      isNepal:     true,
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
    seen.add(a.link); return true;
  });
  setCached(cacheKey, combined);
  return shuffle(combined);
}

// fetch international news from the Currents API
async function fetchNews(apiCategory = "", page = 1) {
  const cacheKey = "currents_" + (apiCategory || "top") + "_" + page;
  if (allNews[cacheKey]) return shuffle(allNews[cacheKey]);
  const cached = getCached(cacheKey);
  if (cached) { allNews[cacheKey] = cached; return shuffle(cached); }

  let url = BASE_URL + "?apiKey=" + API_KEY + "&language=en&page_size=20";
  if (apiCategory) url += "&category=" + apiCategory;
  if (page > 1)    url += "&page_number=" + page;
  console.log("[DevNews] Fetching:", apiCategory || "top");

  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (data.status !== "ok") {
      showFetchError(data.message || "API error.");
      const stale = getCached(cacheKey + "_stale");
      return stale ? shuffle(stale) : [];
    }
    const results = (data.news || []).map(a => ({
      title:       a.title,
      description: a.description,
      link:        a.url,
      image_url:   a.image && a.image !== "None" ? a.image : null,
      pubDate:     a.published,
      category:    Array.isArray(a.category) ? a.category : [a.category],
      source:      "International",
      isNepal:     false,
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

// switch between home, category, saved, and search views
function showView(view) {
  ["home", "category", "saved", "search"].forEach(v => {
    const el = document.getElementById(v + "View");
    if (el) el.style.display = "none";
  });
  const hero   = document.getElementById("heroSection");
  const header = document.getElementById("mainHeader");
  if (hero)   hero.style.display   = "none";
  if (header) header.style.display = "none";

  const target = document.getElementById(view + "View");
  if (target) target.style.display = "block";

  if (view === "home") {
    if (hero)   hero.style.display   = "flex";
    if (header) header.style.display = "block";
  }
  currentView = view;
  const nav = document.getElementById("mainNav");
  window.scrollTo({ top: nav ? nav.offsetTop - 10 : 0, behavior: "smooth" });
}

// load and show the home page
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
      e.preventDefault(); showCategoryView(cat.key);
    });
    (async (c) => {
      const news = await fetchNews(c.apiKey);
      const g = document.getElementById("catGrid_" + c.key);
      if (g) renderNewsGrid(news.slice(0, 6), g);
    })(cat);
  }
}

// show the Nepal news page
async function showNepalView() {
  showView("category");
  currentCategory = "nepal";
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  const hdr = document.getElementById("categoryPageHeader");
  if (hdr) hdr.innerHTML = '<h2><span class="accent-line"></span>🇳🇵 Nepal News</h2>';
  const grid = document.getElementById("categoryNewsGrid");
  if (grid) grid.innerHTML = '<div class="loader-wrap"><div class="loader"></div></div>';
  const news = await fetchAllNepalNews();
  if (grid) renderNewsGrid(news, grid);
  buildSidebarTrending(news);
  const btn = document.getElementById("loadMoreBtn");
  if (btn) btn.style.display = "none";
}

// put breaking news cards into the featured grid
function renderBreakingNews(articles) {
  const grid = document.getElementById("breakingNewsGrid");
  if (!grid) return;
  if (!articles.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#888;padding:40px;">No news available. Check your connection.</p>';
    return;
  }
  grid.innerHTML = "";

  // Big featured card
  const mainWrap = document.createElement("div");
  mainWrap.className = "featured-main";
  mainWrap.appendChild(createCard(articles[0], true));
  grid.appendChild(mainWrap);

  // Right column — 2 cards stacked
  const rightCol = document.createElement("div");
  rightCol.className = "featured-right-col";
  [articles[1], articles[2]].filter(Boolean).forEach(a => rightCol.appendChild(createCard(a, false)));
  grid.appendChild(rightCol);

  // Bottom row — 2 cards side by side
  const bottomArticles = [articles[3], articles[4]].filter(Boolean);
  if (bottomArticles.length) {
    const bottomRow = document.createElement("div");
    bottomRow.className = "featured-bottom-row";
    bottomArticles.forEach(a => bottomRow.appendChild(createCard(a, false)));
    grid.appendChild(bottomRow);
  }
}

// fill a grid container with news cards
function renderNewsGrid(articles, container) {
  container.innerHTML = "";
  if (!articles.length) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>No articles found.</p></div>';
    return;
  }
  articles.forEach(a => container.appendChild(createCard(a, false)));
}

// build a single news card
// the whole card is clickable and opens the article — save button still works separately
function createCard(article, featured = false) {
  if (!article) return document.createElement("div");

  const isSaved  = savedNews.some(s => s.link === article.link);
  const date     = article.pubDate
    ? new Date(article.pubDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";
  const timeAgoStr = article.pubDate ? timeAgo(article.pubDate) : date;
  const category = Array.isArray(article.category) ? article.category[0] : (article.category || "");
  const source   = article.source || "";
  const link     = article.link   || "#";

  // ---- SPRINT 2: wrap the whole card in an <a> tag ----
  const card = document.createElement("a");
  card.href   = link;
  card.target = "_blank";
  card.rel    = "noopener";
  card.className = "news-card" + (featured ? " card-featured" : "");
  // Remove default anchor underline/color — CSS .news-card handles styling
  card.style.cssText = "text-decoration:none;color:inherit;display:flex;flex-direction:column;";

  // card image
  if (article.image_url) {
    const img = document.createElement("img");
    img.className = "card-img";
    img.src   = article.image_url;
    img.alt   = article.title || "";
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
      ${source   ? '<span class="card-source">'   + source   + '</span>' : ""}
    </div>
    <h3>${article.title || "No Title"}</h3>
    ${article.description ? '<p class="card-desc">' + article.description + '</p>' : ""}
    <div class="card-footer">
      <span class="card-date"><i class="fas fa-clock" style="margin-right:4px;"></i>${timeAgoStr}</span>
      <div class="card-actions">
        <button class="card-btn save-btn ${isSaved ? "saved" : ""}" title="${isSaved ? "Unsave" : "Save"}">
          <i class="fa${isSaved ? "s" : "r"} fa-bookmark"></i>
        </button>
      </div>
    </div>
    <span class="card-read-more">Read more <i class="fas fa-arrow-right"></i></span>`;

  card.appendChild(body);

  // Save button — stop propagation so clicking it doesn't open the article
  card.querySelector(".save-btn").addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    toggleSave(article, e.currentTarget);
  });

  // star rating bar + comment icon
  const starBar = buildStarRating(link);
  starBar.addEventListener("click",     e => { e.preventDefault(); e.stopPropagation(); });
  starBar.addEventListener("mouseover", e => e.stopPropagation());

  // comment toggle button — sits on the right of the star bar
  const commentIcon = document.createElement("button");
  commentIcon.className = "comment-icon-btn";
  commentIcon.innerHTML = '<i class="fas fa-comment-dots"></i>';
  commentIcon.title = "Comments";
  starBar.appendChild(commentIcon);

  card.appendChild(starBar);

  // comment panel
  const commentPanel = buildCommentPanel(link);
  // open by default so anyone can read comments
  commentPanel.style.display = "block";
  commentIcon.classList.add("active");
  commentPanel.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); });
  card.appendChild(commentPanel);
  // load right away since it's open
  loadComments(link, commentPanel);

  commentIcon.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    const open = commentPanel.style.display !== "none";
    commentPanel.style.display = open ? "none" : "block";
    commentIcon.classList.toggle("active", !open);
    if (!open) loadComments(link, commentPanel);
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

// show a single category page
async function showCategoryView(category, region = currentRegion) {
  showView("category");
  currentCategory = category;
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  document.querySelectorAll('[data-category="' + category + '"]').forEach(l => l.classList.add("active"));
  const catObj = CATEGORIES.find(c => c.key === category);
  const hdr = document.getElementById("categoryPageHeader");
  if (hdr) hdr.innerHTML =
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
    const div  = document.createElement("div");
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
  btn.disabled    = true;
  categoryPage[currentCategory] = (categoryPage[currentCategory] || 1) + 1;
  const catObj = CATEGORIES.find(c => c.key === currentCategory);
  const news   = await fetchNews(catObj?.apiKey || currentCategory, categoryPage[currentCategory]);
  const grid   = document.getElementById("categoryNewsGrid");
  if (!news.length) { btn.textContent = "No more articles"; return; }
  news.forEach(a => grid.appendChild(createCard(a)));
  btn.innerHTML = 'Load More <i class="fas fa-arrow-down"></i>';
  btn.disabled  = false;
});

// show the saved articles page
function showSavedView() {
  showView("saved");
  const grid = document.getElementById("savedNewsGrid");
  if (!grid) return;
  grid.innerHTML = "";
  if (!savedNews.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fas fa-bookmark"></i><p>No saved articles yet.<br>Click the bookmark icon on any article to save it.</p></div>';
    return;
  }
  savedNews.forEach(a => grid.appendChild(createCard(a)));
}

// search news
async function performSearch(query) {
  if (!query.trim()) return;
  document.getElementById("searchQueryLabel").textContent = '"' + query.trim() + '"';
  showView("search");
  const grid = document.getElementById("searchResultsGrid");
  if (grid) grid.innerHTML = '<div class="loader-wrap"><div class="loader"></div></div>';
  try {
    const url  = SEARCH_URL + "?apiKey=" + API_KEY + "&keywords=" + encodeURIComponent(query.trim()) + "&language=en&page_size=20";
    const res  = await fetch(url);
    const data = await res.json();
    let results = (data.news || []).map(a => ({
      title: a.title, description: a.description, link: a.url,
      image_url: a.image && a.image !== "None" ? a.image : null,
      pubDate: a.published,
      category: Array.isArray(a.category) ? a.category : [a.category],
      source: "International",
    }));
    const nepalCached = getCached("nepal_all") || [];
    const q = query.trim().toLowerCase();
    const nepalMatches = nepalCached.filter(a =>
      (a.title || "").toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q));
    results = [...nepalMatches, ...results];
    if (grid) {
      grid.innerHTML = "";
      if (!results.length) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>No results for "' + query.trim() + '"</p></div>';
        return;
      }
      results.forEach(a => grid.appendChild(createCard(a)));
    }
  } catch {
    if (grid) grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Search failed. Please try again.</p></div>';
  }
}

// save or unsave an article when the bookmark is clicked
async function toggleSave(article, btn) {
  const idx = savedNews.findIndex(s => s.link === article.link);

  if (idx === -1) {
    // --- SAVE ---
    btn.disabled = true;
    try {
      const res = await saveArticleToDB(article);
      if (res.success) {
        savedNews.push(article);
        btn.classList.add("saved");
        btn.title = "Unsave";
        btn.querySelector("i").className = "fas fa-bookmark";
      }
    } catch (e) {
      console.warn("[DevNews] DB save failed, saving to localStorage:", e.message);
      savedNews.push(article);
      localStorage.setItem("savedNews", JSON.stringify(savedNews));
      btn.classList.add("saved");
      btn.title = "Unsave";
      btn.querySelector("i").className = "fas fa-bookmark";
    }
    btn.disabled = false;
  } else {
    // --- UNSAVE ---
    btn.disabled = true;
    try {
      await deleteArticleFromDB(article.link);
    } catch (e) {
      console.warn("[DevNews] DB delete failed:", e.message);
    }
    savedNews.splice(idx, 1);
    btn.classList.remove("saved");
    btn.title = "Save";
    btn.querySelector("i").className = "far fa-bookmark";
    btn.disabled = false;
  }

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

// build the category list in the sidebar
function buildSidebarCategories() {
  const list = document.getElementById("sidebarCatList");
  if (!list) return;
  list.innerHTML = "";
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

// attach all the event listeners
function setupEventListeners() {
  document.querySelectorAll(".nav-link[data-category]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const cat = link.dataset.category;
      if (cat === "home") showHomeView(); else showCategoryView(cat);
      document.getElementById("navLinks").classList.remove("open");
    });
  });
  document.querySelectorAll("[data-region]").forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      currentRegion = link.dataset.region === currentRegion ? "" : link.dataset.region;
      allNews = {};
      showHomeView();
      document.getElementById("navLinks").classList.remove("open");
    });
  });

  document.getElementById("savedBtn").addEventListener("click", () => showSavedView());

  document.getElementById("themeBtn").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    document.getElementById("themeBtn").querySelector("i").className =
      document.body.classList.contains("dark") ? "fas fa-sun" : "fas fa-moon";
    localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
  });
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    const icon = document.getElementById("themeBtn").querySelector("i");
    if (icon) icon.className = "fas fa-sun";
  }

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

  document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });

  document.getElementById("contactForm").addEventListener("submit", e => {
    e.preventDefault();
    const msg = document.getElementById("formMessage");
    msg.textContent = "Thank you! Your message has been sent.";
    msg.className   = "success";
    e.target.reset();
    setTimeout(() => { msg.textContent = ""; msg.className = ""; }, 4000);
  });
}

// star rating bar
function buildStarRating(articleUrl) {
  const wrap = document.createElement("div");
  wrap.className = "star-rating-wrap";

  const myRating = parseInt(localStorage.getItem("star_" + articleUrl) || "0");

  const stars = document.createElement("div");
  stars.className = "star-row";

  for (let i = 1; i <= 5; i++) {
    const s = document.createElement("button");
    s.className   = "star-btn" + (i <= myRating ? " on" : "");
    s.dataset.val = i;
    s.innerHTML   = "★";
    s.title       = i + " star" + (i > 1 ? "s" : "");
    stars.appendChild(s);
  }

  const info = document.createElement("span");
  info.className = "star-info";
  info.textContent = myRating ? "Your rating: " + myRating + "★" : "Rate this";

  wrap.appendChild(stars);
  wrap.appendChild(info);

  // highlight stars on hover
  stars.addEventListener("mouseover", e => {
    const btn = e.target.closest(".star-btn");
    if (!btn) return;
    const val = parseInt(btn.dataset.val);
    stars.querySelectorAll(".star-btn").forEach(s => {
      s.classList.toggle("hover", parseInt(s.dataset.val) <= val);
    });
  });
  stars.addEventListener("mouseleave", () => {
    stars.querySelectorAll(".star-btn").forEach(s => s.classList.remove("hover"));
  });

  // click a star to rate
  stars.addEventListener("click", async e => {
    const btn = e.target.closest(".star-btn");
    if (!btn) return;
    const val = parseInt(btn.dataset.val);

    // update stars on screen straight away
    stars.querySelectorAll(".star-btn").forEach(s => {
      s.classList.toggle("on", parseInt(s.dataset.val) <= val);
    });
    info.textContent = "Your rating: " + val + "★";
    localStorage.setItem("star_" + articleUrl, val);

    // then save to the database
    try {
      const res  = await fetch(RATINGS_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: articleUrl, sid: BROWSER_ID, stars: val }),
      });
      const data = await res.json();
      if (data.success && data.avg !== undefined) {
        info.textContent = "Your: " + val + "★  |  Avg: " + data.avg + "★ (" + data.total + ")";
      }
    } catch {
      // keep the local rating if the DB is unreachable
    }
  });

  // load the average rating in the background
  fetchStarAvg(articleUrl, info, myRating);
  return wrap;
}

async function fetchStarAvg(articleUrl, infoEl, myRating) {
  try {
    const res  = await fetch(RATINGS_API + "?url=" + encodeURIComponent(articleUrl));
    const data = await res.json();
    if (data.success && data.total > 0) {
      if (myRating) {
        infoEl.textContent = "Your: " + myRating + "★  |  Avg: " + data.avg + "★ (" + data.total + ")";
      } else {
        infoEl.textContent = "Avg: " + data.avg + "★ (" + data.total + ")";
      }
    }
  } catch { /* silent */ }
}

// comment panel
function buildCommentPanel(articleUrl) {
  const panel = document.createElement("div");
  panel.className = "comment-panel";

  panel.innerHTML = `
    <div class="comment-list" data-url="${articleUrl}">
      <p class="comment-empty">No comments yet — be the first!</p>
    </div>
    <div class="comment-form">
      <div class="comment-input-row">
        <textarea class="comment-text" placeholder="Write a comment…" rows="1" maxlength="500"></textarea>
        <button class="comment-submit-btn" title="Send"><i class="fas fa-paper-plane"></i></button>
      </div>
      <p class="comment-status"></p>
    </div>`;

  const textarea = panel.querySelector(".comment-text");

  // grow the textarea as the user types
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  });

  // handle sending a comment
  panel.querySelector(".comment-submit-btn").addEventListener("click", async () => {
    const comment = textarea.value.trim();
    const status  = panel.querySelector(".comment-status");
    if (!comment) { showCommentStatus(status, "Write something first.", "error"); return; }

    const btn = panel.querySelector(".comment-submit-btn");
    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // show the comment right away before the DB responds
    const authorName = (window.AuthState?.loggedIn && window.AuthState?.user?.name)
      ? window.AuthState.user.name
      : "Anonymous";
    const localComment = { comment, name: authorName, posted_at: new Date().toISOString() };
    const list = panel.querySelector(".comment-list");
    const empty = list.querySelector(".comment-empty");
    if (empty) empty.remove();
    prependComment(list, localComment);

    textarea.value = "";
    textarea.style.height = "auto";

    // save to DB
    try {
      const res  = await fetch(COMMENTS_API, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sid: BROWSER_ID, url: articleUrl, comment }),
      });
      const data = await res.json();
      if (!data.success) {
        showCommentStatus(status, "Saved locally — DB sync failed.", "error");
      }
    } catch {
      showCommentStatus(status, "Saved locally — no server connection.", "error");
    }

    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
  });

  // pressing Enter sends the comment, Shift+Enter adds a new line
  textarea.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      panel.querySelector(".comment-submit-btn").click();
    }
  });

  return panel;
}

function showCommentStatus(el, msg, type) {
  el.textContent = msg;
  el.className   = "comment-status " + type;
  setTimeout(() => { el.textContent = ""; el.className = "comment-status"; }, 3500);
}

// load comments from the database for this article
async function loadComments(articleUrl, panel) {
  const list = panel.querySelector(".comment-list");
  const existing = list.querySelectorAll(".comment-item");
  list.innerHTML = '<div class="comment-loading"><i class="fas fa-spinner fa-spin"></i></div>';
  existing.forEach(el => list.appendChild(el));

  try {
    const res  = await fetch(COMMENTS_API + "?url=" + encodeURIComponent(articleUrl));
    const data = await res.json();

    const spinner = list.querySelector(".comment-loading");
    if (spinner) spinner.remove();

    if (data.success && data.comments.length) {
      const fragment = document.createDocumentFragment();
      data.comments.forEach(c => {
        const item = document.createElement("div");
        item.className = "comment-item";
        item.innerHTML = `
          <div class="comment-meta">
            <span class="comment-author"><i class="fas fa-user-circle"></i> ${c.name || "Anonymous"}</span>
            <span class="comment-time">${timeAgo(c.posted_at)}</span>
          </div>
          <p class="comment-text-body">${c.comment}</p>`;
        fragment.appendChild(item);
      });
      list.prepend(fragment);
    } else if (!list.querySelector(".comment-item")) {
      list.innerHTML = '<p class="comment-empty">No comments yet — be the first!</p>';
    }
  } catch {
    const spinner = list.querySelector(".comment-loading");
    if (spinner) spinner.remove();
    if (!list.querySelector(".comment-item")) {
      list.innerHTML = '<p class="comment-empty">No comments yet — be the first!</p>';
    }
  }
}

function prependComment(list, comment) {
  const item = document.createElement("div");
  item.className = "comment-item";
  item.innerHTML = `
    <div class="comment-meta">
      <span class="comment-author"><i class="fas fa-user-circle"></i> ${comment.name || "Anonymous"}</span>
      <span class="comment-time">${timeAgo(comment.posted_at)}</span>
    </div>
    <p class="comment-text-body">${comment.comment}</p>`;
  list.prepend(item);
}

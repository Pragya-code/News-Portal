// profile page
const AUTH_API = "api/auth.php";
const SAVED_API = "api/saved_news.php";

// same browser ID as in main.js — used to load guest saves
function getBrowserId() {
    let bid = localStorage.getItem("devsnews_bid");
    if (!bid) {
        bid = "bid-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("devsnews_bid", bid);
    }
    return bid;
}

// escape characters before putting user data into HTML
function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

// builds a saved news card for the profile page
// build a card for a saved article on the profile page
function renderSavedCard(a) {
    const card = document.createElement("a");
    card.href = a.link || "#";
    card.target = "_blank";
    card.rel = "noopener";
    card.className = "news-card";
    card.style.cssText = "text-decoration:none;color:inherit;display:flex;flex-direction:column;";

    const img = document.createElement("div");
    img.className = "card-img-placeholder";
    img.innerHTML = '<i class="fas fa-bookmark"></i>';
    card.appendChild(img);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${a.category?.[0] ? `<span class="card-category">${escapeHtml(a.category[0])}</span>` : ""}
            ${a.source ? `<span class="card-source">${escapeHtml(a.source)}</span>` : ""}
        </div>
        <h3>${escapeHtml(a.title || "No Title")}</h3>
        ${a.description ? `<p class="card-desc">${escapeHtml(a.description)}</p>` : ""}
        <div class="card-footer">
            <span class="card-date">${escapeHtml(a.pubDate || "")}</span>
        </div>
    `;
    card.appendChild(body);
    return card;
}

async function loadProfile() {
    const res = await fetch(AUTH_API);
    const data = await res.json();

    if (!data.loggedIn || !data.user) {
        location.href = "index.html";
        return;
    }

    const user = data.user;
    document.getElementById("profileName").textContent = user.name || "";
    document.getElementById("profileEmail").textContent = user.email || "";
    document.getElementById("profileAvatar").textContent = (user.name || "U").charAt(0).toUpperCase();

    const sid = getBrowserId();
    const savedRes = await fetch(SAVED_API + "?sid=" + encodeURIComponent(sid));
    const savedData = await savedRes.json();

    const grid = document.getElementById("profileSavedGrid");
    grid.innerHTML = "";

    if (!savedData.success || !savedData.data.length) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-bookmark"></i><p>No saved articles yet.</p></div>`;
        return;
    }

    savedData.data.forEach(a => grid.appendChild(renderSavedCard(a)));
}

document.getElementById("passwordForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const old_password = document.getElementById("oldPassword").value;
    const new_password = document.getElementById("newPassword").value;

    const res = await fetch(AUTH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "change_password",
            old_password,
            new_password
        })
    });

    const data = await res.json();
    if (data.success) {
        alert("Password updated");
        e.target.reset();
    } else {
        alert(data.error || "Password update failed");
    }
});

document.addEventListener("DOMContentLoaded", loadProfile);
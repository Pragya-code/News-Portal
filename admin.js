
const ADMIN_ARTICLES_API = "api/admin_articles.php";
const ADMIN_USERS_API = "api/admin_users.php";

// prevent XSS by escaping special characters before putting text in HTML
function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

// open the add/edit article popup
function openArticleModal(article = null) {
    const modal = document.getElementById("articleModal");
    const title = document.getElementById("articleModalTitle");
    const id = document.getElementById("articleId");
    const t = document.getElementById("articleTitle");
    const d = document.getElementById("articleDescription");
    const i = document.getElementById("articleImageUrl");
    const c = document.getElementById("articleCategory");
    const s = document.getElementById("articleSource");

    if (!modal) return;

    if (article) {
        title.textContent = "Edit Article";
        id.value = article.id || "";
        t.value = article.title || "";
        d.value = article.description || "";
        i.value = article.image_url || "";
        c.value = article.category || "";
        s.value = article.source || "";
    } else {
        title.textContent = "Add Article";
        id.value = "";
        t.value = "";
        d.value = "";
        i.value = "";
        c.value = "";
        s.value = "";
    }

    modal.style.display = "flex";
}

// close the article popup
function closeArticleModal() {
    const modal = document.getElementById("articleModal");
    if (modal) modal.style.display = "none";
}

// fetch all articles from the DB and show them in the table
async function loadAdminArticles() {
    try {
        const res = await fetch(ADMIN_ARTICLES_API);
        const data = await res.json();

        const tbody = document.querySelector("#adminArticlesTable tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!data.success || !Array.isArray(data.data)) {
            tbody.innerHTML = `<tr><td colspan="5">No articles found</td></tr>`;
            return;
        }

        data.data.forEach(a => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${escapeHtml(a.title || "")}</td>
                <td>${escapeHtml(a.category || "")}</td>
                <td>${escapeHtml(a.source || "")}</td>
                <td>${escapeHtml(a.created_at || "")}</td>
                <td class="row-actions">
                    <button class="admin-btn small" data-action="edit">Edit</button>
                    <button class="admin-btn small danger" data-action="delete">Delete</button>
                </td>
            `;

            tr.querySelector('[data-action="edit"]')?.addEventListener("click", () => openArticleModal(a));
            tr.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteArticle(a.id));

            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Failed to load articles:", err);
    }
}

// save article — creates new if no ID, updates if ID exists
async function saveArticle(e) {
    e.preventDefault();

    const id = document.getElementById("articleId").value.trim();
    const payload = {
        title: document.getElementById("articleTitle").value.trim(),
        description: document.getElementById("articleDescription").value.trim(),
        image_url: document.getElementById("articleImageUrl").value.trim(),
        category: document.getElementById("articleCategory").value.trim(),
        source: document.getElementById("articleSource").value.trim()
    };

    if (!payload.title) {
        alert("Title is required");
        return;
    }

    try {
        const res = await fetch(ADMIN_ARTICLES_API, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(id ? { id, ...payload } : payload)
        });

        const data = await res.json();

        if (data.success) {
            closeArticleModal();
            loadAdminArticles();
        } else {
            alert(data.error || "Failed to save article");
        }
    } catch (err) {
        console.error("Save article failed:", err);
        alert("Save failed");
    }
}

// delete an article after confirmation
async function deleteArticle(id) {
    if (!confirm("Delete this article?")) return;

    try {
        const res = await fetch(ADMIN_ARTICLES_API, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });

        const data = await res.json();
        if (data.success) {
            loadAdminArticles();
        } else {
            alert(data.error || "Failed to delete article");
        }
    } catch (err) {
        console.error("Delete failed:", err);
    }
}

// fetch all registered users and show them in the table
async function loadAdminUsers() {
    try {
        const res = await fetch(ADMIN_USERS_API);
        const data = await res.json();

        const tbody = document.querySelector("#adminUsersTable tbody");
        if (!tbody) return;
        tbody.innerHTML = "";

        if (!data.success || !Array.isArray(data.data)) {
            tbody.innerHTML = `<tr><td colspan="5">No users found</td></tr>`;
            return;
        }

        data.data.forEach(u => {
            const tr = document.createElement("tr");

            const statusText = Number(u.is_banned) === 1 ? "Banned" : "Active";
            const statusClass = Number(u.is_banned) === 1 ? "banned" : "active";
            const buttonText = Number(u.is_banned) === 1 ? "Unban" : "Ban";

            tr.innerHTML = `
                <td>${escapeHtml(u.name || "")}</td>
                <td>${escapeHtml(u.email || "")}</td>
                <td>${escapeHtml(u.role || "")}</td>
                <td><span class="status-pill ${statusClass}">${statusText}</span></td>
                <td class="row-actions">
                    <button class="admin-btn small warning">${buttonText}</button>
                </td>
            `;

            tr.querySelector("button")?.addEventListener("click", () => toggleBan(u.id));
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Failed to load users:", err);
    }
}

// ban or unban a user
async function toggleBan(id) {
    try {
        const res = await fetch(ADMIN_USERS_API, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });

        const data = await res.json();
        if (data.success) {
            loadAdminUsers();
        } else {
            alert(data.error || "Failed to update user");
        }
    } catch (err) {
        console.error("Toggle ban failed:", err);
    }
}

// runs when the admin page loads
document.addEventListener("DOMContentLoaded", () => {
    loadAdminArticles();
    loadAdminUsers();

    document.getElementById("addArticleBtn")?.addEventListener("click", () => openArticleModal());
    document.getElementById("closeArticleModal")?.addEventListener("click", closeArticleModal);
    document.getElementById("articleForm")?.addEventListener("submit", saveArticle);

    document.getElementById("articleModal")?.addEventListener("click", (e) => {
        if (e.target.id === "articleModal") closeArticleModal();
    });
});
<?php
session_start();
if(!isset($_SESSION['user']) || ($_SESSION['user']['role'] ?? '') !== 'admin'){
    header("Location: index.html");
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Dashboard - Dev's News</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body class="admin-page">

<div class="admin-layout">

    <!-- left sidebar with nav links -->
    <aside class="admin-sidebar">
        <h2>Dev's News</h2>
        <p>Admin Panel</p>

        <ul>
            <li><a href="#articlesSection">Articles</a></li>
            <li><a href="#usersSection">Users</a></li>
            <li><a href="index.html">Back to Site</a></li>
        </ul>
    </aside>

    <!-- main content area -->
    <main class="admin-main">

        <!-- articles management table -->
        <section class="admin-section" id="articlesSection">

            <div class="admin-section-top">
                <h1>Articles</h1>

                <button id="addArticleBtn" class="admin-btn primary">
                    + Add Article
                </button>
            </div>

            <div class="table-wrap">
                <table class="admin-table" id="adminArticlesTable">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Source</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody></tbody>
                </table>
            </div>

        </section>

        <!-- users management table -->
        <section class="admin-section" id="usersSection">

            <div class="admin-section-top">
                <h1>Users</h1>
            </div>

            <div class="table-wrap">
                <table class="admin-table" id="adminUsersTable">

                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody></tbody>

                </table>
            </div>

        </section>

    </main>

</div>

<!-- admin dashboard scripts -->
<script src="admin.js"></script>

</body>
</body>
</html>
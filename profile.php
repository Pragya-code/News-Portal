<?php
// must be logged in — guests get redirected to the homepage
session_start();
if(!isset($_SESSION['user'])){
    header("Location: index.html");
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Profile - Dev's News</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body class="profile-page">

<div class="profile-shell">
    <div class="profile-card">

    <div class="profile-banner">
        <div class="profile-avatar big" id="profileAvatar">U</div>
    </div>

    <div class="profile-info">
        <h1 id="profileName">User</h1>
        <p id="profileEmail" class="profile-email">email</p>

        <div class="profile-form-wrap">

            <h3>Change Password</h3>

            <form id="passwordForm" class="profile-form">
            <input type="password" id="oldPassword" placeholder="Old password" required>
            <input type="password" id="newPassword" placeholder="New password" required>
            <button type="submit" class="admin-btn primary">Update Password</button>
        </form>

        <a href="index.html" class="back-link">
    <i class="fas fa-arrow-left"></i> Back to News
</a>

        </div> <!-- closes profile-form-wrap -->

    </div> <!-- closes profile-info -->

</div> <!-- closes profile-card -->

<div class="profile-content">
        <div class="section-header">
            <h2><span class="accent-line"></span>Saved Articles</h2>
        </div>
        <div class="news-grid" id="profileSavedGrid"></div>
    </div>
</div>

<!-- profile page logic -->
<!-- profile page scripts -->
<script src="profile.js"></script>
</body>
</html>
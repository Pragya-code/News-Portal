<?php
// handles comments for each article
// GET  ?url=   — load comments
// POST          — post a comment (shows real name if logged in)

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// start session to check if user is logged in
session_start();
require_once("db.php");
$conn = getDB();

// load comments for an article ────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $url = trim($_GET['url'] ?? '');
    if (!$url) { echo json_encode(["success" => false, "message" => "url required"]); exit; }

    $stmt = $conn->prepare(
        "SELECT id, name, comment, posted_at FROM article_comments
         WHERE article_url = ? ORDER BY posted_at DESC LIMIT 50"
    );
    $stmt->bind_param("s", $url);
    $stmt->execute();
    $result = $stmt->get_result();
    $comments = [];
    while ($row = $result->fetch_assoc()) {
        $comments[] = $row;
    }
    $stmt->close();
    $conn->close();

    echo json_encode(["success" => true, "comments" => $comments]);
    exit;
}

// save a new comment ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body    = json_decode(file_get_contents("php://input"), true);
    $sid     = trim($body['sid']     ?? '');
    $url     = trim($body['url']     ?? '');
    $comment = trim($body['comment'] ?? '');

    if (!$sid || !$url || !$comment) {
        echo json_encode(["success" => false, "message" => "All fields required"]);
        exit;
    }
    $comment = substr(htmlspecialchars($comment, ENT_QUOTES, 'UTF-8'), 0, 2000);

    // if logged in use their name, otherwise Anonymous
    if (isset($_SESSION['user']['name']) && $_SESSION['user']['name'] !== '') {
        $name = $_SESSION['user']['name'];
    } else {
        $name = 'Anonymous';
    }

    $stmt = $conn->prepare(
        "INSERT INTO article_comments (session_id, article_url, name, comment)
         VALUES (?, ?, ?, ?)"
    );
    $stmt->bind_param("ssss", $sid, $url, $name, $comment);
    $stmt->execute();
    $newId = $conn->insert_id;
    $stmt->close();
    $conn->close();

    echo json_encode([
        "success"  => true,
        "comment"  => [
            "id"        => $newId,
            "name"      => $name,
            "comment"   => $comment,
            "posted_at" => date("Y-m-d H:i:s"),
        ]
    ]);
    exit;
}

echo json_encode(["success" => false, "message" => "Method not allowed"]);

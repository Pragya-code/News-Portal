<?php
// 5-star rating system
// GET  ?url=   — get the average stars and vote count
// POST          — submit or update a rating

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once("db.php");
$conn = getDB();

// get average stars and total votes for an article
function getStats($conn, $url) {
    $stmt = $conn->prepare(
        "SELECT ROUND(AVG(stars), 1) AS avg, COUNT(*) AS total
         FROM article_ratings WHERE article_url = ?"
    );
    $stmt->bind_param("s", $url);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return [
        "avg"   => $row['avg']   ? (float)$row['avg']  : 0,
        "total" => $row['total'] ? (int)$row['total']  : 0,
    ];
}

// GET — return the average rating
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $url = trim($_GET['url'] ?? '');
    if (!$url) { echo json_encode(["success" => false, "message" => "url required"]); exit; }
    echo json_encode(array_merge(["success" => true], getStats($conn, $url)));
    $conn->close();
    exit;
}

// POST — save the rating, update if this browser already rated
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body  = json_decode(file_get_contents("php://input"), true);
    $url   = trim($body['url']   ?? '');
    $sid   = trim($body['sid']   ?? '');
    $stars = (int)($body['stars'] ?? 0);

    if (!$url || !$sid || $stars < 1 || $stars > 5) {
        echo json_encode(["success" => false, "message" => "Invalid input"]);
        exit;
    }

    $stmt = $conn->prepare(
        "INSERT INTO article_ratings (session_id, article_url, stars)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE stars = VALUES(stars), rated_at = CURRENT_TIMESTAMP"
    );
    $stmt->bind_param("ssi", $sid, $url, $stars);
    $stmt->execute();
    $stmt->close();

    echo json_encode(array_merge(["success" => true], getStats($conn, $url)));
    $conn->close();
    exit;
}

echo json_encode(["success" => false, "message" => "Method not allowed"]);

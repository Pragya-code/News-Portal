<?php
// saves and loads bookmarked articles — works for both guests and logged-in users
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();
require_once("db.php");

// read the browser ID from the request
function getSessionId() {
    $sid = isset($_GET['sid']) ? $_GET['sid'] : '';
    if (!$sid && isset($_SERVER['HTTP_X_SESSION_ID'])) $sid = $_SERVER['HTTP_X_SESSION_ID'];
    $sid = preg_replace('/[^a-zA-Z0-9\-]/', '', $sid);
    if ($sid !== '' && (strlen($sid) < 8 || strlen($sid) > 128)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid session ID']);
        exit;
    }
    return $sid;
}

// returns the logged-in user's ID, or null if guest
function currentUserId() {
    return isset($_SESSION['user']['id']) ? (int)$_SESSION['user']['id'] : null;
}

$method = $_SERVER['REQUEST_METHOD'];

// load saved articles for this user/browser
if ($method === 'GET') {
    $conn = getDB();
    $sid = getSessionId();
    $userId = currentUserId();

    if ($userId) {
        // user is logged in — only load their own saved articles
        $stmt = $conn->prepare(
            "SELECT * FROM saved_news WHERE user_id = ? ORDER BY saved_at DESC"
        );
        $stmt->bind_param('i', $userId);
    } else {
        $stmt = $conn->prepare("SELECT * FROM saved_news WHERE session_id = ? ORDER BY saved_at DESC");
        $stmt->bind_param('s', $sid);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    $news = [];

    while ($row = $result->fetch_assoc()) {
        $news[] = [
            'id'          => $row['id'],
            'title'       => $row['title'],
            'description' => $row['description'],
            'link'        => $row['link'],
            'image_url'   => $row['image_url'],
            'source'      => $row['source'],
            'category'    => $row['category'] ? [$row['category']] : [],
            'pubDate'     => $row['pub_date'],
            'saved_at'    => $row['saved_at'],
        ];
    }

    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'data' => $news]);
    exit;
}

// save an article
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$body) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON body']);
        exit;
    }

    $sid      = isset($body['sid']) ? preg_replace('/[^a-zA-Z0-9\-]/', '', $body['sid']) : getSessionId();
    // get user id — from session if logged in, from request body if not
    $userId   = currentUserId() ?: (isset($body['uid']) ? (int)$body['uid'] : null);
    $title    = isset($body['title']) ? substr($body['title'], 0, 500) : '';
    $desc     = isset($body['description']) ? substr($body['description'], 0, 1000) : '';
    $link     = isset($body['link']) ? substr($body['link'], 0, 2048) : '';
    $image    = isset($body['image_url']) ? substr($body['image_url'], 0, 2048) : '';
    $source   = isset($body['source']) ? substr($body['source'], 0, 255) : '';
    $category = isset($body['category']) ? (is_array($body['category']) ? $body['category'][0] : $body['category']) : '';
    $category = substr($category, 0, 255);
    $pubDate  = isset($body['pubDate']) ? substr($body['pubDate'], 0, 100) : '';

    if ((!$userId && !$sid) || !$title || !$link) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'sid/title/link are required']);
        exit;
    }

    $conn = getDB();

    // don't save the same article twice
    if ($userId) {
        $check = $conn->prepare("SELECT id FROM saved_news WHERE user_id = ? AND link = ?");
        $check->bind_param("is", $userId, $link);
    } else {
        $check = $conn->prepare("SELECT id FROM saved_news WHERE session_id = ? AND link = ?");
        $check->bind_param("ss", $sid, $link);
    }

    $check->execute();
    $check->store_result();

    if ($check->num_rows > 0) {
        $check->close();
        $conn->close();
        echo json_encode(['success' => true, 'inserted' => false, 'message' => 'Already saved']);
        exit;
    }
    $check->close();

    // save the article
    $stmt = $conn->prepare(
        "INSERT INTO saved_news (user_id, session_id, title, description, link, image_url, source, category, pub_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    $userIdValue = $userId ?: null;
    $stmt->bind_param('issssssss', $userIdValue, $sid, $title, $desc, $link, $image, $source, $category, $pubDate);
    $stmt->execute();

    $inserted = $stmt->affected_rows;
    $newId = $conn->insert_id;

    $stmt->close();
    $conn->close();

    echo json_encode([
        'success'  => true,
        'inserted' => $inserted > 0,
        'id'       => $newId,
        'message'  => $inserted > 0 ? 'Article saved' : 'Already saved'
    ]);
    exit;
}

// unsave / remove a saved article
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$body) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON body']);
        exit;
    }

    $sid    = isset($body['sid']) ? preg_replace('/[^a-zA-Z0-9\-]/', '', $body['sid']) : getSessionId();
    // get user id — same logic as above
    $userId = currentUserId() ?: (isset($body['uid']) ? (int)$body['uid'] : null);
    $link   = isset($body['link']) ? $body['link'] : '';

    if (!$link) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'link is required']);
        exit;
    }

    $conn = getDB();

    if ($userId) {
        $stmt = $conn->prepare("DELETE FROM saved_news WHERE link = ? AND (user_id = ? OR session_id = ?)");
        $stmt->bind_param('sis', $link, $userId, $sid);
    } else {
        $stmt = $conn->prepare("DELETE FROM saved_news WHERE session_id = ? AND link = ?");
        $stmt->bind_param('ss', $sid, $link);
    }

    $stmt->execute();
    $deleted = $stmt->affected_rows;

    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'deleted' => $deleted > 0]);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
?>
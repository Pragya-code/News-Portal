<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();
require_once("db.php");

if (!isset($_SESSION['user']) || ($_SESSION['user']['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$conn = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// list all articles
if ($method === 'GET') {
    $result = $conn->query("SELECT * FROM admin_articles ORDER BY created_at DESC");
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

// add a new article
if ($method === 'POST') {
    $body = json_decode(file_get_contents("php://input"), true);

    $title = trim($body['title'] ?? '');
    $description = trim($body['description'] ?? '');
    $image_url = trim($body['image_url'] ?? '');
    $category = trim($body['category'] ?? '');
    $source = trim($body['source'] ?? '');

    // title is the only required field
    if ($title === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Title is required']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO admin_articles (title, description, image_url, category, source) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $title, $description, $image_url, $category, $source);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Article added']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to add article']);
    }
    $stmt->close();
    exit;
}

// edit an existing article
if ($method === 'PUT') {
    $body = json_decode(file_get_contents("php://input"), true);
    $id = (int)($body['id'] ?? 0);

    $title = trim($body['title'] ?? '');
    $description = trim($body['description'] ?? '');
    $image_url = trim($body['image_url'] ?? '');
    $category = trim($body['category'] ?? '');
    $source = trim($body['source'] ?? '');

    // need both an ID and a title to update
    if ($id <= 0 || $title === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID and Title are required']);
        exit;
    }

    $stmt = $conn->prepare("UPDATE admin_articles SET title = ?, description = ?, image_url = ?, category = ?, source = ? WHERE id = ?");
    $stmt->bind_param("sssssi", $title, $description, $image_url, $category, $source, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Article updated']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to update article']);
    }
    $stmt->close();
    exit;
}

// remove an article
if ($method === 'DELETE') {
    $body = json_decode(file_get_contents("php://input"), true);
    $id = (int)($body['id'] ?? 0);

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID is required']);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM admin_articles WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Article deleted']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to delete article']);
    }
    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
?>
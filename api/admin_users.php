<?php
// manage users from the admin dashboard
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();
require_once("db.php");

// only admins can use this
if (!isset($_SESSION['user']) || ($_SESSION['user']['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$conn = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// get all users
if ($method === 'GET') {
    $result = $conn->query("SELECT id, name, email, role, is_banned, created_at FROM users ORDER BY created_at DESC");
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

// ban or unban a user
if ($method === 'PUT') {
    $body = json_decode(file_get_contents("php://input"), true);
    $id = (int)($body['id'] ?? 0);

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'User ID is required']);
        exit;
    }

    // flip the ban — if banned, unban; if active, ban
    $stmt = $conn->prepare("UPDATE users SET is_banned = IF(is_banned = 1, 0, 1) WHERE id = ?");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'User updated']);
    } else {
        echo json_encode(['success' => false, 'error' => 'Failed to update user']);
    }

    $stmt->close();
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
?>
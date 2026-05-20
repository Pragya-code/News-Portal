<?php
// database connection settings
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'devsnews');

// connect to the database and return the connection
function getDB() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'DB connection failed: ' . $conn->connect_error
        ]);
        exit;
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}
?>
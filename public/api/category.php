<?php
header('Content-Type: application/json');
require_once "../../config/db.php";

$category = $_GET['category'] ?? '';
$limit = $_GET['limit'] ?? 20;

$stmt = $pdo->prepare("
    SELECT * FROM news 
    WHERE category = ? 
    ORDER BY pubDate DESC 
    LIMIT ?
");

$stmt->bindValue(1, $category);
$stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
$stmt->execute();

echo json_encode($stmt->fetchAll());
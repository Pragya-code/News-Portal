<?php
header('Content-Type: application/json');
require_once "../../config/db.php";

$date = $_GET['date'] ?? '';
$limit = $_GET['limit'] ?? 20;

$stmt = $pdo->prepare("
    SELECT * FROM news 
    WHERE DATE(pubDate) = ? 
    ORDER BY pubDate DESC 
    LIMIT ?
");

$stmt->bindValue(1, $date);
$stmt->bindValue(2, (int)$limit, PDO::PARAM_INT);
$stmt->execute();

echo json_encode($stmt->fetchAll());
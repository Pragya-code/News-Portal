<?php
header('Content-Type: application/json');
require_once "../../config/db.php";

$limit = $_GET['limit'] ?? 20;

$stmt = $pdo->prepare("SELECT * FROM news ORDER BY pubDate DESC LIMIT ?");
$stmt->bindValue(1, (int)$limit, PDO::PARAM_INT);
$stmt->execute();

echo json_encode($stmt->fetchAll());
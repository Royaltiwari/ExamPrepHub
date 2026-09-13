<?php
// ============================================
// DATABASE CONFIG
// ============================================
$host = "localhost";
$user = "root";
$pass = "";
$dbname = "examprephub";

$conn = new mysqli($host, $user, $pass, $dbname);
if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "DB Error: " . $conn->connect_error]));
}
$conn->set_charset("utf8mb4");

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
?>
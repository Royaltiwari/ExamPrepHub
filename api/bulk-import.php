<?php
require_once __DIR__ . '/config.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['testId']) || empty($input['questions'])) {
    echo json_encode(["success" => false, "message" => "testId ya questions missing"]);
    exit;
}

$testId = $conn->real_escape_string($input['testId']);
$questions = $input['questions'];

$stmt = $conn->prepare("
    INSERT INTO questions 
    (test_id, subject, chapter, correct_answer,
     question_hindi, question_english, question_text,
     options_hindi, options_english, options_text,
     explanation_hindi, explanation_english, explanation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");

if (!$stmt) {
    echo json_encode(["success" => false, "message" => "SQL prepare failed: " . $conn->error]);
    exit;
}

$imported = 0;

foreach ($questions as $q) {
    $subject   = $q['subject']  ?? '';
    $chapter   = $q['chapter']  ?? '';
    $correct   = (int)($q['correctAnswer'] ?? 0);

    $qHindi    = $q['questionHindi']    ?? '';
    $qEnglish  = $q['questionEnglish']  ?? '';
    $qText     = $q['questionText']     ?? ($qHindi ?: $qEnglish);

    $optHindi   = json_encode($q['optionsHindi']   ?? [], JSON_UNESCAPED_UNICODE);
    $optEnglish = json_encode($q['optionsEnglish'] ?? [], JSON_UNESCAPED_UNICODE);
    $optText    = json_encode($q['options']        ?? [], JSON_UNESCAPED_UNICODE);

    $expHindi   = $q['explanationHindi']   ?? '';
    $expEnglish = $q['explanationEnglish'] ?? '';
    $exp        = $q['explanation']        ?? ($expHindi ?: $expEnglish);

    $stmt->bind_param(
        "sssisssssssss",
        $testId, $subject, $chapter, $correct,
        $qHindi, $qEnglish, $qText,
        $optHindi, $optEnglish, $optText,
        $expHindi, $expEnglish, $exp
    );

    if ($stmt->execute()) $imported++;
}

$stmt->close();
$conn->close();

echo json_encode([
    "success"  => true,
    "imported" => $imported,
    "message"  => "$imported questions imported"
]);
?>
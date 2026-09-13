<?php
// ============================================================
// UNIVERSAL QUESTION PARSER (PHP)
// ============================================================

class QuestionParser {

    public static function parse($rawText) {
        if (!$rawText) return [];

        $text = str_replace(["\r\n", "\r"], "\n", $rawText);
        $text = preg_replace("/\n{3,}/", "\n\n", $text);
        $text = preg_replace("/^\s*Page\s+\d+\s*$/im", "", $text);
        $text = trim($text);

        preg_match_all(
            '/(?:^|\n)\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[\.\)]\s+/iu',
            $text,
            $matches,
            PREG_OFFSET_CAPTURE
        );

        if (empty($matches[0])) {
            $single = self::parseBlock($text);
            return $single ? [$single] : [];
        }

        $blocks = [];
        $count = count($matches[0]);

        for ($i = 0; $i < $count; $i++) {
            $startPos = $matches[0][$i][1] + strlen($matches[0][$i][0]);
            $endPos = ($i + 1 < $count) ? $matches[0][$i + 1][1] : strlen($text);
            $block = trim(substr($text, $startPos, $endPos - $startPos));
            if ($block) $blocks[] = $block;
        }

        $questions = [];
        foreach ($blocks as $block) {
            $q = self::parseBlock($block);
            if ($q) $questions[] = $q;
        }

        return $questions;
    }

    private static function parseBlock($block) {
        if (mb_strlen(trim($block)) < 5) return null;

        $optionsMap = [];
        preg_match_all(
            '/(?:^|\n)\s*[\(\[]?([A-Da-d])[\)\].\:\-]\s*(.+?)(?=\n\s*[\(\[]?[A-Da-d][\)\].\:\-]|\n\s*(?:Answer|Ans|Correct|Explanation|Exp|व्याख्या|उत्तर)|\z)/isu',
            $block,
            $optMatches,
            PREG_SET_ORDER
        );

        foreach ($optMatches as $m) {
            $letter = strtoupper($m[1]);
            $value = trim(preg_replace('/\s+/u', ' ', $m[2]));
            if ($value && !isset($optionsMap[$letter])) {
                $optionsMap[$letter] = $value;
            }
        }

        $correctAnswer = 0;
        if (preg_match('/(?:Answer|Ans|Correct\s*Answer|Correct|उत्तर|सही\s*उत्तर)\s*[\:\-\.]\s*[\(\[]?([A-Da-d])[\)\]]?/iu', $block, $ansMatch)) {
            $correctAnswer = ord(strtoupper($ansMatch[1])) - 65;
        }

        $explanation = "";
        if (preg_match('/(?:Explanation|Exp|व्याख्या|समाधान)\s*[\:\-\.]\s*([\s\S]*?)(?=\n\s*(?:Q(?:uestion)?\s*\.?\s*)?\d+\s*[\.\)]|\z)/iu', $block, $expMatch)) {
            $explanation = trim(preg_replace('/\s+/u', ' ', $expMatch[1]));
        }

        $firstOptPos = preg_match('/(?:^|\n)\s*[\(\[]?[A-Da-d][\)\].\:\-]\s+/u', $block, $fo, PREG_OFFSET_CAPTURE)
            ? $fo[0][1]
            : -1;

        if ($firstOptPos > 0) {
            $questionText = trim(substr($block, 0, $firstOptPos));
        } else {
            $cutPos = preg_match('/(?:Answer|Ans|Explanation|Exp|व्याख्या|उत्तर)\s*[\:\-\.]/iu', $block, $cm, PREG_OFFSET_CAPTURE)
                ? $cm[0][1]
                : -1;
            $questionText = $cutPos > 0 ? trim(substr($block, 0, $cutPos)) : trim($block);
        }

        $questionText = trim(preg_replace('/\s+/u', ' ', $questionText));
        $questionText = preg_replace('/[\:\-]\s*$/u', '', $questionText);

        if (!$questionText) return null;

        $optionsArr = [
            $optionsMap['A'] ?? "",
            $optionsMap['B'] ?? "",
            $optionsMap['C'] ?? "",
            $optionsMap['D'] ?? ""
        ];

        $filled = count(array_filter($optionsArr));
        if ($filled < 2) return null;

        $isHindi = preg_match('/[\x{0900}-\x{097F}]/u', $questionText);

        $obj = [
            "correctAnswer"    => $correctAnswer,
            "options"          => $optionsArr,
            "questionText"     => $questionText,
            "question"         => $questionText,
            "explanation"      => $explanation,
            "questionHindi"    => "",
            "questionEnglish"  => "",
            "optionsHindi"     => [],
            "optionsEnglish"   => [],
            "explanationHindi" => "",
            "explanationEnglish" => ""
        ];

        if ($isHindi) {
            $obj["questionHindi"]    = $questionText;
            $obj["optionsHindi"]     = $optionsArr;
            $obj["explanationHindi"] = $explanation;
        } else {
            $obj["questionEnglish"]    = $questionText;
            $obj["optionsEnglish"]     = $optionsArr;
            $obj["explanationEnglish"] = $explanation;
        }

        return $obj;
    }
}
?>
<?php
set_time_limit(0);

require_once "../config/db.php";
require_once "../classes/NewsFetcher.php";

$apiKey = "YOUR_API_KEY";
$fetcher = new NewsFetcher($apiKey);

$categories = ["business","entertainment","health","science","sports","technology","world","politics"];

foreach ($categories as $category) {

    echo "Fetching: $category\n";

    $result = $fetcher->fetchNews($category);

    if ($result && isset($result['results'])) {

        foreach ($result['results'] as $news) {

            $api_id = $news['article_id'] ?? null;

            // check duplicate
            $check = $pdo->prepare("SELECT id FROM news WHERE api_article_id = ?");
            $check->execute([$api_id]);

            if ($check->rowCount() == 0) {

                $stmt = $pdo->prepare("
                    INSERT INTO news 
                    (api_article_id, title, description, content, url, image_url, video_url, category, country, language, pubDate)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");

                $stmt->execute([
                    $api_id,
                    $news['title'] ?? '',
                    $news['description'] ?? '',
                    $news['content'] ?? '',
                    $news['link'] ?? '',
                    $news['image_url'] ?? '',
                    $news['video_url'] ?? '',
                    $category,
                    isset($news['country']) ? implode(',', $news['country']) : 'np',
                    $news['language'] ?? 'en',
                    isset($news['pubDate']) ? date('Y-m-d H:i:s', strtotime($news['pubDate'])) : date('Y-m-d H:i:s')
                ]);
            }
        }

        echo "Done: $category\n";
        sleep(5);
    }
}
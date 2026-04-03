<?php
class NewsFetcher {
    private $apiKey;
    private $baseUrl = "https://newsdata.io/api/1/news";

    public function __construct($apiKey) {
        $this->apiKey = $apiKey;
    }

    public function fetchNews($category, $country='np', $language='en', $page=1) {

        $url = $this->baseUrl . "?category=$category&country=$country&language=$language&apikey={$this->apiKey}&page=$page";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        curl_close($ch);

        if ($httpCode == 429) {
            sleep(10);
            return $this->fetchNews($category, $country, $language, $page);
        }

        if ($httpCode != 200 || !$response) return false;

        return json_decode($response, true);
    }
}
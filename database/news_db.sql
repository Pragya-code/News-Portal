-- Filename: news_db.sql
-- SQL dump for news_db database

-- Create database
CREATE DATABASE IF NOT EXISTS `news_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `news_db`;

-- Drop table if exists
DROP TABLE IF EXISTS `news`;

-- Create news table
CREATE TABLE `news` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `api_article_id` VARCHAR(255) DEFAULT NULL,
  `title` TEXT DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `url` TEXT DEFAULT NULL,
  `image_url` TEXT DEFAULT NULL,
  `video_url` TEXT DEFAULT NULL,
  `category` VARCHAR(255) DEFAULT NULL,
  `country` VARCHAR(50) DEFAULT NULL,
  `language` VARCHAR(10) DEFAULT NULL,
  `pubDate` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `api_article_id` (`api_article_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
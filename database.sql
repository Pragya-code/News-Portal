CREATE DATABASE IF NOT EXISTS devsnews CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE devsnews;

-- stores saved/bookmarked articles
CREATE TABLE IF NOT EXISTS saved_news (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NULL,
  session_id  VARCHAR(128)  NULL,
  title       TEXT          NOT NULL,
  description TEXT,
  link        VARCHAR(2048) NOT NULL,
  image_url   VARCHAR(2048),
  source      VARCHAR(255),
  category    VARCHAR(255),
  pub_date    VARCHAR(100),
  saved_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_session_save (session_id(128), link(255)),
  UNIQUE KEY unique_user_save (user_id, link(255))
);

-- registered users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user','admin') DEFAULT 'user',
  is_banned TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- articles written by admin
CREATE TABLE IF NOT EXISTS admin_articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  image_url VARCHAR(2048),
  category VARCHAR(255),
  source VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- public comments on articles 
CREATE TABLE IF NOT EXISTS article_comments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(128) NOT NULL,
  article_url VARCHAR(2048) NOT NULL,
  name        VARCHAR(255) NOT NULL DEFAULT 'Anonymous',
  comment     TEXT NOT NULL,
  posted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_url (article_url(255))
);

-- star ratings for articles 
CREATE TABLE IF NOT EXISTS article_ratings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(128) NOT NULL,
  article_url VARCHAR(2048) NOT NULL,
  stars       TINYINT NOT NULL,
  rated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rating (session_id(128), article_url(255))
);

-- This email was used as admin
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
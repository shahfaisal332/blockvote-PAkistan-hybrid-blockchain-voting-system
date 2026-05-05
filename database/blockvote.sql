-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: May 05, 2026 at 10:01 AM
-- Server version: 9.5.0
-- PHP Version: 8.3.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `blockvote`
--

-- --------------------------------------------------------

--
-- Table structure for table `candidates`
--

DROP TABLE IF EXISTS `candidates`;
CREATE TABLE IF NOT EXISTS `candidates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `party_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `symbol_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `symbol_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chain_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `group_id` (`group_id`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `election_config`
--

DROP TABLE IF EXISTS `election_config`;
CREATE TABLE IF NOT EXISTS `election_config` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `contract_address` varchar(42) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `election_config`
--

INSERT INTO `election_config` (`id`, `title`, `start_time`, `end_time`, `contract_address`, `created_at`) VALUES
(15, 'Election S', '2026-05-05 14:01:00', '2026-05-05 15:26:00', '0x848814c0a8cA3d89AF79a437CC7a8D515dE21335', '2026-05-05 09:00:56');

-- --------------------------------------------------------

--
-- Table structure for table `groups_tbl`
--

DROP TABLE IF EXISTS `groups_tbl`;
CREATE TABLE IF NOT EXISTS `groups_tbl` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chain_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `voters`
--

DROP TABLE IF EXISTS `voters`;
CREATE TABLE IF NOT EXISTS `voters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cnic` char(13) COLLATE utf8mb4_unicode_ci NOT NULL,
  `voter_hash` varchar(66) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cnic` (`cnic`),
  UNIQUE KEY `voter_hash` (`voter_hash`)
) ENGINE=MyISAM AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `votes`
--

DROP TABLE IF EXISTS `votes`;
CREATE TABLE IF NOT EXISTS `votes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `voter_hash` varchar(66) COLLATE utf8mb4_unicode_ci NOT NULL,
  `voter_cnic_hash` varchar(66) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_id` int NOT NULL,
  `candidate_id` int NOT NULL,
  `vote_hash` varchar(66) COLLATE utf8mb4_unicode_ci NOT NULL,
  `voted_at` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tx_hash` varchar(66) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `block_number` int DEFAULT NULL,
  `election_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `vote_hash` (`vote_hash`),
  UNIQUE KEY `unique_vote` (`voter_hash`,`group_id`),
  KEY `group_id` (`group_id`),
  KEY `candidate_id` (`candidate_id`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

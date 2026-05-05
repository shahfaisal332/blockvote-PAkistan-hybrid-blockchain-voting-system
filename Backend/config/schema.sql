-- ============================================================
-- BlockVote Pakistan — Run this ONCE in phpMyAdmin
-- Steps: open phpMyAdmin → SQL tab → paste all → click Go
-- ============================================================

CREATE DATABASE IF NOT EXISTS blockvote
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE blockvote;

-- Voters (offchain — only admin can add/edit/delete)
CREATE TABLE IF NOT EXISTS voters (
  id          INT          AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  cnic        CHAR(13)     NOT NULL UNIQUE,
  voter_hash  VARCHAR(66)  NOT NULL UNIQUE,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Groups (MNA / MPA etc.)
CREATE TABLE IF NOT EXISTS groups_tbl (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  chain_id   INT          DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Candidates (with party_name)
CREATE TABLE IF NOT EXISTS candidates (
  id           INT          AUTO_INCREMENT PRIMARY KEY,
  group_id     INT          NOT NULL,
  name         VARCHAR(120) NOT NULL,
  party_name   VARCHAR(120) NOT NULL DEFAULT '',
  symbol_name  VARCHAR(120) NOT NULL,
  symbol_image VARCHAR(255) DEFAULT NULL,
  chain_id     INT          DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups_tbl(id) ON DELETE CASCADE
);

-- Election config
CREATE TABLE IF NOT EXISTS election_config (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(200) NOT NULL,
  start_time       DATETIME     NOT NULL,
  end_time         DATETIME     NOT NULL,
  contract_address VARCHAR(42)  DEFAULT NULL,
  created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
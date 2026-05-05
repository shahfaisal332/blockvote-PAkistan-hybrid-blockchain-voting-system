-- ============================================================
-- Run this in phpMyAdmin → SQL tab → paste → click Go
-- Upgrades your existing votes table for the hybrid system
-- ============================================================

USE blockvote;

-- Drop old votes table if it exists and recreate with new columns
-- (if you have existing votes, use ALTER TABLE instead — see below)

CREATE TABLE IF NOT EXISTS votes (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  voter_hash       VARCHAR(66)  NOT NULL,           -- keccak256(cnic+name)
  voter_cnic_hash  VARCHAR(66)  NOT NULL,           -- keccak256(cnic) — privacy
  group_id         INT          NOT NULL,
  candidate_id     INT          NOT NULL,
  vote_hash        VARCHAR(66)  NOT NULL UNIQUE,    -- integrity hash logged onchain
  voted_at         VARCHAR(40)  NOT NULL,           -- ISO timestamp
  tx_hash          VARCHAR(66)  DEFAULT NULL,       -- Ethereum tx hash (set async)
  block_number     INT          DEFAULT NULL,       -- block where hash was logged
  UNIQUE KEY unique_vote (voter_hash, group_id),
  FOREIGN KEY (group_id)     REFERENCES groups_tbl(id)  ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id)  ON DELETE CASCADE
);

-- ============================================================
-- If your votes table already exists, run these ALTER commands
-- instead of the CREATE TABLE above:
-- ============================================================

-- ALTER TABLE votes ADD COLUMN IF NOT EXISTS voter_cnic_hash VARCHAR(66) DEFAULT NULL;
-- ALTER TABLE votes ADD COLUMN IF NOT EXISTS vote_hash       VARCHAR(66) DEFAULT NULL;
-- ALTER TABLE votes ADD COLUMN IF NOT EXISTS voted_at        VARCHAR(40) DEFAULT NULL;
-- ALTER TABLE votes ADD COLUMN IF NOT EXISTS tx_hash         VARCHAR(66) DEFAULT NULL;
-- ALTER TABLE votes ADD COLUMN IF NOT EXISTS block_number    INT         DEFAULT NULL;

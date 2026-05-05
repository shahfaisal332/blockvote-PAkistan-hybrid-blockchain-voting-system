const express    = require("express");
const router     = express.Router();
const { ethers } = require("ethers");
const db         = require("../config/db");
const BACKEND    = process.env.BACKEND_URL || "http://localhost:5000";

// ── Helpers ───────────────────────────────────────────────

// Get the currently active election (start <= now <= end)
async function getActiveElection() {
  const now = new Date();
  const [rows] = await db.query(
    `SELECT * FROM election_config
     WHERE start_time <= ? AND end_time >= ?
     ORDER BY id DESC LIMIT 1`,
    [now, now]
  );
  return rows[0] || null;
}

// Get the most recently ended election (the one voters see as "previous")
async function getLastEndedElection() {
  const now = new Date();
  const [rows] = await db.query(
    `SELECT * FROM election_config
     WHERE end_time < ?
     ORDER BY end_time DESC LIMIT 1`,
    [now]
  );
  return rows[0] || null;
}

// Get upcoming election
async function getUpcomingElection() {
  const now = new Date();
  const [rows] = await db.query(
    `SELECT * FROM election_config
     WHERE start_time > ?
     ORDER BY start_time ASC LIMIT 1`,
    [now]
  );
  return rows[0] || null;
}

// Build results for a given election id
async function buildResults(electionId) {
  const [groups] = await db.query("SELECT * FROM groups_tbl ORDER BY id");
  for (const g of groups) {
    const [cands] = await db.query(
      `SELECT c.id, c.name, c.party_name, c.symbol_name, c.symbol_image,
              COUNT(v.id) as vote_count
       FROM candidates c
       LEFT JOIN votes v
         ON v.candidate_id = c.id AND v.election_id = ?
       WHERE c.group_id = ?
       GROUP BY c.id
       ORDER BY vote_count DESC`,
      [electionId, g.id]
    );
    g.candidates = cands.map(c => ({
      ...c,
      symbol_image_url: c.symbol_image
        ? `${BACKEND}/uploads/${c.symbol_image}` : null,
      vote_count: Number(c.vote_count),
    }));
  }
  return groups;
}

// ── POST /api/voter/login ─────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const name = (req.body.name || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    const cnic = (req.body.cnic || "").replace(/\D/g, "").replace(/\s/g, "");
    if (!name || !cnic)
      return res.status(400).json({ error: "Name and CNIC required" });
    if (!/^\d{13}$/.test(cnic))
      return res.status(400).json({ error: "CNIC must be exactly 13 digits" });

    const [rows] = await db.query(
      "SELECT * FROM voters WHERE cnic=? AND LOWER(name)=LOWER(?)", [cnic, name]
    );
    if (!rows.length)
      return res.status(401).json({ error: "CNIC or name not found. Please contact admin." });

    const voterHash = ethers.keccak256(ethers.toUtf8Bytes(cnic + name.toLowerCase()));
    res.json({ success: true, voterHash, voterName: rows[0].name, cnic });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/voter/election ───────────────────────────────
// Returns: active election → upcoming → last ended
router.get("/election", async (req, res) => {
  try {
    const active = await getActiveElection();
    if (active) return res.json({ ...active, electionState: "active" });

    const upcoming = await getUpcomingElection();
    if (upcoming) return res.json({ ...upcoming, electionState: "upcoming" });

    const ended = await getLastEndedElection();
    if (ended) return res.json({ ...ended, electionState: "ended" });

    res.json(null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/voter/groups ─────────────────────────────────
router.get("/groups", async (req, res) => {
  try {
    const [groups] = await db.query("SELECT * FROM groups_tbl ORDER BY id");
    for (const g of groups) {
      const [cands] = await db.query(
        "SELECT * FROM candidates WHERE group_id=? ORDER BY id", [g.id]
      );
      g.candidates = cands.map(c => ({
        ...c,
        symbol_image_url: c.symbol_image
          ? `${BACKEND}/uploads/${c.symbol_image}` : null,
      }));
    }
    res.json(groups);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/voter/myvotes ───────────────────────────────
// Returns which groups this voter already voted in for the ACTIVE election
router.post("/myvotes", async (req, res) => {
  try {
    const { voterHash } = req.body;
    if (!voterHash) return res.status(400).json({ error: "voterHash required" });

    const active = await getActiveElection();
    if (!active) return res.json({ votedGroups: [] });

    const [rows] = await db.query(
      "SELECT group_id FROM votes WHERE voter_hash=? AND election_id=?",
      [voterHash, active.id]
    );
    res.json({ votedGroups: rows.map(r => r.group_id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/voter/vote ──────────────────────────────────
router.post("/vote", async (req, res) => {
  try {
    const { voterHash, voterCnic, groupId, candidateId } = req.body;
    if (!voterHash || !voterCnic || !groupId || !candidateId)
      return res.status(400).json({ error: "All fields required" });

    // Must have active election
    const active = await getActiveElection();
    if (!active)
      return res.status(400).json({ error: "No election is currently active" });

    // Check not already voted in this group for this election
    const [existing] = await db.query(
      "SELECT id FROM votes WHERE voter_hash=? AND group_id=? AND election_id=?",
      [voterHash, groupId, active.id]
    );
    if (existing.length)
      return res.status(409).json({ error: "Already voted in this group" });

    // Validate candidate belongs to group
    const [cand] = await db.query(
      "SELECT id FROM candidates WHERE id=? AND group_id=?",
      [candidateId, groupId]
    );
    if (!cand.length)
      return res.status(400).json({ error: "Invalid candidate for this group" });

    const timestamp = new Date().toISOString();
    const voteHash  = ethers.keccak256(
      ethers.toUtf8Bytes(voterCnic + candidateId + groupId + timestamp)
    );

    await db.query(
      `INSERT INTO votes
       (voter_hash, voter_cnic_hash, group_id, candidate_id, vote_hash, voted_at, election_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        voterHash,
        ethers.keccak256(ethers.toUtf8Bytes(voterCnic)),
        groupId,
        candidateId,
        voteHash,
        timestamp,
        active.id,
      ]
    );

    res.json({ success: true, voteHash, timestamp });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/voter/results ────────────────────────────────
// Results for CURRENT active/ended election (for admin results tab)
router.get("/results", async (req, res) => {
  try {
    const now = new Date();
    // Get most recent election (active or just ended)
    const [rows] = await db.query(
      "SELECT * FROM election_config ORDER BY id DESC LIMIT 1"
    );
    if (!rows.length) return res.json([]);
    const groups = await buildResults(rows[0].id);
    res.json(groups);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/voter/previous-result ───────────────────────
// Returns results of ONLY the most recently ended election
// This is what voters see as "Previous Election Results"
router.get("/previous-result", async (req, res) => {
  try {
    const ended = await getLastEndedElection();
    if (!ended) return res.json(null);

    const groups = await buildResults(ended.id);
    res.json({
      election: ended,
      groups,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
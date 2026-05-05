const express    = require("express");
const router     = express.Router();
const jwt        = require("jsonwebtoken");
const multer     = require("multer");
const path       = require("path");
const fs         = require("fs");
const { ethers } = require("ethers");
const db         = require("../config/db");
const auth       = require("../middleware/auth");

const OWNER  = (process.env.OWNER_WALLET || "").toLowerCase();
const SECRET = process.env.JWT_SECRET || "blockvote_fyp_2025_change_this_now";

// ── Multer image upload ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(null, `sym_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_, file, cb) =>
    cb(null, /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.originalname)),
});

// ── POST /api/admin/login ───────────────────────────────────
router.post("/login", (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ error: "Wallet address required" });
  if (wallet.toLowerCase() !== OWNER)
    return res.status(403).json({ error: "This wallet is not the contract owner" });
  const token = jwt.sign({ wallet: wallet.toLowerCase() }, SECRET, { expiresIn: "8h" });
  res.json({ token, wallet: wallet.toLowerCase() });
});

router.get("/me", auth, (req, res) => res.json({ wallet: req.admin.wallet }));

// ── Election ────────────────────────────────────────────────

// GET /api/admin/election
// Returns the active election, or upcoming, or most recent ended
router.get("/election", async (req, res) => {
  try {
    const now = new Date();

    // 1. Active election (started and not ended)
    let [rows] = await db.query(
      `SELECT * FROM election_config
       WHERE start_time <= ? AND end_time >= ?
       ORDER BY id DESC LIMIT 1`,
      [now, now]
    );
    if (rows.length) return res.json(rows[0]);

    // 2. Upcoming election
    [rows] = await db.query(
      `SELECT * FROM election_config
       WHERE start_time > ?
       ORDER BY start_time ASC LIMIT 1`,
      [now]
    );
    if (rows.length) return res.json(rows[0]);

    // 3. Most recently ended election
    [rows] = await db.query(
      `SELECT * FROM election_config
       ORDER BY id DESC LIMIT 1`
    );
    res.json(rows[0] || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/election
// ✅ INSERT new election — does NOT delete old ones so history is preserved
router.post("/election", auth, async (req, res) => {
  try {
    const { title, start_time, end_time, contract_address } = req.body;
    if (!title || !start_time || !end_time)
      return res.status(400).json({ error: "title, start_time and end_time are required" });

    // ✅ INSERT only — old elections stay in DB for history
    await db.query(
      "INSERT INTO election_config (title, start_time, end_time, contract_address) VALUES (?,?,?,?)",
      [title.trim(), start_time, end_time, contract_address || null]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Election history endpoints (NEW) ────────────────────────

// GET /api/admin/elections/history
// Returns ALL past (ended) elections with vote counts per candidate
// Ordered newest first. Used in admin History tab.
router.get("/elections/history", auth, async (req, res) => {
  try {
    const now = new Date();
    const BACKEND = process.env.BACKEND_URL || "http://localhost:5000";

    // Get all ended elections, newest first
    const [elections] = await db.query(
      `SELECT * FROM election_config
       WHERE end_time < ?
       ORDER BY end_time DESC`,
      [now]
    );

    // For each election build its results snapshot
    for (const el of elections) {
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
          [el.id, g.id]
        );
        g.candidates = cands.map(c => ({
          ...c,
          symbol_image_url: c.symbol_image
            ? `${BACKEND}/uploads/${c.symbol_image}` : null,
          vote_count: Number(c.vote_count),
        }));
      }

      el.groups = groups;
      el.total_votes = groups.reduce(
        (sum, g) => sum + g.candidates.reduce((s, c) => s + c.vote_count, 0),
        0
      );
    }

    res.json(elections);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/elections/all-except-last
// Deletes ALL ended elections except the most recent one.
// Also deletes their associated votes.
router.delete("/elections/all-except-last", auth, async (req, res) => {
  try {
    const now = new Date();

    // Find all ended elections ordered newest first
    const [ended] = await db.query(
      `SELECT id FROM election_config
       WHERE end_time < ?
       ORDER BY end_time DESC`,
      [now]
    );

    if (ended.length <= 1) {
      // Nothing to delete — only 0 or 1 ended election
      return res.json({ success: true, deleted: 0, message: "Nothing to delete" });
    }

    // Keep the first one (most recent = index 0), delete the rest
    const toDelete = ended.slice(1).map(e => e.id);

    // Delete votes for these elections first (foreign key safe)
    for (const id of toDelete) {
      await db.query("DELETE FROM votes WHERE election_id = ?", [id]);
    }

    // Delete the election records
    await db.query(
      `DELETE FROM election_config WHERE id IN (${toDelete.map(() => "?").join(",")})`,
      toDelete
    );

    res.json({ success: true, deleted: toDelete.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/elections/:id
// Deletes ONE specific past election and its votes.
// Refuses to delete if it is the most recent ended election.
router.delete("/elections/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date();

    // Find the most recent ended election
    const [latest] = await db.query(
      `SELECT id FROM election_config
       WHERE end_time < ?
       ORDER BY end_time DESC LIMIT 1`,
      [now]
    );

    if (latest.length && String(latest[0].id) === String(id)) {
      return res.status(403).json({
        error: "Cannot delete the most recent election. It is protected.",
      });
    }

    // Delete votes for this election
    await db.query("DELETE FROM votes WHERE election_id = ?", [id]);

    // Delete the election record
    await db.query("DELETE FROM election_config WHERE id = ?", [id]);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Groups ──────────────────────────────────────────────────
router.get("/groups", async (req, res) => {
  try {
    const BACKEND = process.env.BACKEND_URL || "http://localhost:5000";
    const [groups] = await db.query("SELECT * FROM groups_tbl ORDER BY id");
    for (const g of groups) {
      const [cands] = await db.query(
        "SELECT * FROM candidates WHERE group_id=? ORDER BY id", [g.id]
      );
      g.candidates = cands.map(c => ({
        ...c,
        symbol_image_url: c.symbol_image ? `/uploads/${c.symbol_image}` : null,
      }));
    }
    res.json(groups);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/groups", auth, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Group name required" });
    const [r] = await db.query(
      "INSERT INTO groups_tbl (name) VALUES (?)", [name]
    );
    res.json({ id: r.insertId, name, candidates: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/groups/:id", auth, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Group name required" });
    await db.query("UPDATE groups_tbl SET name=? WHERE id=?", [name, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/groups/:id", auth, async (req, res) => {
  try {
    const [cands] = await db.query(
      "SELECT symbol_image FROM candidates WHERE group_id=?", [req.params.id]
    );
    cands.forEach(c => {
      if (c.symbol_image) {
        const fp = path.join(__dirname, "../uploads", c.symbol_image);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    });
    await db.query("DELETE FROM groups_tbl WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Candidates ──────────────────────────────────────────────
router.post("/candidates", auth, upload.single("symbol_image"), async (req, res) => {
  try {
    const { group_id, name, party_name, symbol_name } = req.body;
    if (!group_id || !name?.trim() || !symbol_name?.trim())
      return res.status(400).json({ error: "group_id, name and symbol_name required" });
    const filename = req.file ? req.file.filename : null;
    const [r] = await db.query(
      "INSERT INTO candidates (group_id,name,party_name,symbol_name,symbol_image) VALUES (?,?,?,?,?)",
      [group_id, name.trim(), (party_name || "").trim(), symbol_name.trim(), filename]
    );
    res.json({
      id: r.insertId, name: name.trim(),
      party_name: (party_name || "").trim(),
      symbol_name: symbol_name.trim(),
      symbol_image_url: filename ? `/uploads/${filename}` : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/candidates/:id", auth, upload.single("symbol_image"), async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM candidates WHERE id=?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Candidate not found" });
    const old = rows[0];
    let filename = old.symbol_image;
    if (req.file) {
      if (filename) {
        const fp = path.join(__dirname, "../uploads", filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      filename = req.file.filename;
    }
    const name        = (req.body.name        || old.name).trim();
    const party_name  = (req.body.party_name  !== undefined ? req.body.party_name : old.party_name || "").trim();
    const symbol_name = (req.body.symbol_name || old.symbol_name).trim();
    await db.query(
      "UPDATE candidates SET name=?,party_name=?,symbol_name=?,symbol_image=? WHERE id=?",
      [name, party_name, symbol_name, filename, req.params.id]
    );
    res.json({ success: true, symbol_image_url: filename ? `/uploads/${filename}` : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/candidates/:id", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT symbol_image FROM candidates WHERE id=?", [req.params.id]
    );
    if (rows[0]?.symbol_image) {
      const fp = path.join(__dirname, "../uploads", rows[0].symbol_image);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.query("DELETE FROM candidates WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Voters ──────────────────────────────────────────────────
router.get("/voters", auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id,name,cnic,created_at,updated_at FROM voters ORDER BY id DESC"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/voters", auth, async (req, res) => {
  try {
    const name = (req.body.name || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    const cnic = (req.body.cnic || "").replace(/\D/g, "").replace(/\s/g, "");
    if (!name || name.length < 3)
      return res.status(400).json({ error: "Valid name required (min 3 chars)" });
    if (!/^\d{13}$/.test(cnic))
      return res.status(400).json({ error: "CNIC must be exactly 13 digits" });
    const voterHash = ethers.keccak256(ethers.toUtf8Bytes(cnic + name.toLowerCase()));
    await db.query(
      "INSERT INTO voters (name,cnic,voter_hash) VALUES (?,?,?)",
      [name, cnic, voterHash]
    );
    res.json({ success: true, name, cnic });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "This CNIC is already registered" });
    res.status(500).json({ error: e.message });
  }
});

router.put("/voters/:id", auth, async (req, res) => {
  try {
    const name = (req.body.name || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    const cnic = (req.body.cnic || "").replace(/\D/g, "").replace(/\s/g, "");
    if (!name || name.length < 3)
      return res.status(400).json({ error: "Valid name required" });
    if (!/^\d{13}$/.test(cnic))
      return res.status(400).json({ error: "CNIC must be 13 digits" });
    const voterHash = ethers.keccak256(ethers.toUtf8Bytes(cnic + name.toLowerCase()));
    await db.query(
      "UPDATE voters SET name=?,cnic=?,voter_hash=? WHERE id=?",
      [name, cnic, voterHash, req.params.id]
    );
    res.json({ success: true });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "CNIC already registered" });
    res.status(500).json({ error: e.message });
  }
});

router.delete("/voters/:id", auth, async (req, res) => {
  try {
    await db.query("DELETE FROM voters WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
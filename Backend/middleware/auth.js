const jwt    = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "blockvote_fyp_2025_change_this_now";

module.exports = (req, res, next) => {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
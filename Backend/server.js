require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const rateLimit = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/admin", require("./routes/admin"));
app.use("/api/voter", require("./routes/voter"));
app.get("/api/health", (_, res) => res.json({ ok: true, time: new Date() }));

app.listen(PORT, () => console.log(`\n✅  Backend → http://localhost:${PORT}\n`));
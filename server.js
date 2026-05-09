require("dotenv").config();

const app       = require("../server/src/app");
const dbConnect = require("../server/src/config/db");

// ─── Database ─────────────────────────────────────────────────────────────────
dbConnect().catch((err) => {
  console.error("[DB] Failed to connect:", err);
  process.exit(1);
});

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

// ─── Process-level safety nets ────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  server.close(() => process.exit(1));
});
require("dotenv").config();

const app = require("./src/app");
const dbConnect = require("./src/config/db");

// ─── Database ─────────────────────────────────────────────────────────────────
dbConnect().catch((err) => {
  console.error("[DB] Failed to connect:", err);
  process.exit(1);
});

// ─── HTTP server — local only ─────────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection]", reason);
    server.close(() => process.exit(1));
  });

  process.on("uncaughtException", (err) => {
    console.error("[uncaughtException]", err);
    server.close(() => process.exit(1));
  });
}

module.exports = app;
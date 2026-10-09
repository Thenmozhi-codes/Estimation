const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await pool.query("SELECT 1");

    console.log("✅ MySQL connected successfully");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ MySQL connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
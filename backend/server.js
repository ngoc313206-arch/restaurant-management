const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: 5432,
  user: process.env.DB_USER || "restaurant_user",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "restaurant_db"
});

// Kiểm tra backend
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      message: "Backend va PostgreSQL dang hoat dong"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database unavailable" });
  }
});

// Lấy danh sách bàn ăn
app.get("/api/tables", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM restaurant_tables ORDER BY id"
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Khong the lay danh sach ban" });
  }
});

// Lấy thực đơn
app.get("/api/menu", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.name, m.price, m.is_available,
             c.name AS category_name
      FROM menu_items m
      LEFT JOIN categories c ON m.category_id = c.id
      ORDER BY m.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Khong the lay thuc don" });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Backend running on port 3000");
});

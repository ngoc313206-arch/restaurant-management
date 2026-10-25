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
// Kiểm tra dữ liệu bàn ăn
const validStatuses = ["available", "occupied", "reserved"];

function validateTable(body) {
  const tableNumber = Number(body.table_number);
  const capacity = Number(body.capacity);

  if (
    !Number.isSafeInteger(tableNumber) ||
    tableNumber <= 0 ||
    !Number.isSafeInteger(capacity) ||
    capacity <= 0
  ) {
    return null;
  }

  const status = body.status ?? "available";
  if (!validStatuses.includes(status)) return null;

  return { tableNumber, capacity, status };
}

// Thêm bàn
app.post("/api/tables", async (req, res) => {
  const data = validateTable(req.body);

  if (!data) {
    return res.status(400).json({ error: "Dữ liệu bàn không hợp lệ" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO restaurant_tables
       (table_number, capacity, status)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.tableNumber, data.capacity, data.status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Số bàn đã tồn tại" });
    }
    console.error(err);
    res.status(500).json({ error: "Không thể thêm bàn" });
  }
});

// Sửa bàn
app.put("/api/tables/:id", async (req, res) => {
  const id = Number(req.params.id);
  const data = validateTable(req.body);

  if (!Number.isSafeInteger(id) || id <= 0 || !data) {
    return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
  }

  try {
    const result = await pool.query(
      `UPDATE restaurant_tables
       SET table_number = $1, capacity = $2, status = $3
       WHERE id = $4 RETURNING *`,
      [data.tableNumber, data.capacity, data.status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Không tìm thấy bàn" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Số bàn đã tồn tại" });
    }
    console.error(err);
    res.status(500).json({ error: "Không thể sửa bàn" });
  }
});

// Xóa bàn
app.delete("/api/tables/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: "ID không hợp lệ" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM restaurant_tables WHERE id = $1 RETURNING *",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Không tìm thấy bàn" });
    }

    res.json({ message: "Đã xóa bàn", table: result.rows[0] });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        error: "Không thể xóa bàn đã có đơn hàng liên quan"
      });
    }
    console.error(err);
    res.status(500).json({ error: "Không thể xóa bàn" });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Backend running on port 3000");
});

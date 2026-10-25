
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "20kb" }));

const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: 5432,
  user: process.env.DB_USER || "restaurant_user",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "restaurant_db"
});

// ======================================
// HÀM DÙNG CHUNG
// ======================================

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handleError(res, err, message) {
  if (err.code === "23505") {
    return res.status(409).json({
      error: "Dữ liệu đã tồn tại"
    });
  }

  if (err.code === "23503") {
    return res.status(409).json({
      error: "Dữ liệu đang được sử dụng hoặc liên kết không hợp lệ"
    });
  }

  console.error(err);
  return res.status(500).json({ error: message });
}

// ======================================
// 1. KIỂM TRA HỆ THỐNG
// ======================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      message: "Backend va PostgreSQL dang hoat dong"
    });
  } catch (err) {
    handleError(res, err, "Database unavailable");
  }
});

// ======================================
// 2. QUẢN LÝ BÀN ĂN
// ======================================

const tableStatuses = [
  "available",
  "occupied",
  "reserved"
];

function validateTable(body) {
  const tableNumber = Number(body.table_number);
  const capacity = Number(body.capacity);
  const status = body.status ?? "available";

  if (
    !Number.isSafeInteger(tableNumber) ||
    tableNumber <= 0 ||
    !Number.isSafeInteger(capacity) ||
    capacity <= 0 ||
    !tableStatuses.includes(status)
  ) {
    return null;
  }

  return { tableNumber, capacity, status };
}

// Lấy danh sách bàn
app.get("/api/tables", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM restaurant_tables ORDER BY table_number"
    );

    res.json(result.rows);
  } catch (err) {
    handleError(res, err, "Không thể tải danh sách bàn");
  }
});

// Thêm bàn
app.post("/api/tables", async (req, res) => {
  const data = validateTable(req.body);

  if (!data) {
    return res.status(400).json({
      error: "Thông tin bàn không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO restaurant_tables
       (table_number, capacity, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.tableNumber, data.capacity, data.status]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, "Không thể thêm bàn");
  }
});

// Sửa bàn
app.put("/api/tables/:id", async (req, res) => {
  const id = validId(req.params.id);
  const data = validateTable(req.body);

  if (!id || !data) {
    return res.status(400).json({
      error: "Thông tin cập nhật không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `UPDATE restaurant_tables
       SET table_number=$1, capacity=$2, status=$3
       WHERE id=$4
       RETURNING *`,
      [data.tableNumber, data.capacity, data.status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy bàn"
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleError(res, err, "Không thể cập nhật bàn");
  }
});

// Xóa bàn
app.delete("/api/tables/:id", async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: "ID bàn không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM restaurant_tables
       WHERE id=$1
       RETURNING *`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy bàn"
      });
    }

    res.json({
      message: "Đã xóa bàn",
      table: result.rows[0]
    });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        error: "Không thể xóa bàn đã có đơn hàng liên quan"
      });
    }

    handleError(res, err, "Không thể xóa bàn");
  }
});

// ======================================
// 3. DANH MỤC MÓN ĂN
// ======================================

app.get("/api/categories", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM categories ORDER BY id"
    );

    res.json(result.rows);
  } catch (err) {
    handleError(res, err, "Không thể tải danh mục");
  }
});

// ======================================
// 4. QUẢN LÝ THỰC ĐƠN
// ======================================

function validateMenu(body) {
  const name =
    typeof body.name === "string"
      ? body.name.trim()
      : "";

  const price = Number(body.price);
  const categoryId = validId(body.category_id);
  const isAvailable = body.is_available ?? true;

  if (
    !name ||
    name.length > 150 ||
    body.price === "" ||
    body.price === null ||
    body.price === undefined ||
    !Number.isFinite(price) ||
    price < 0 ||
    price > 9999999999.99 ||
    !categoryId ||
    typeof isAvailable !== "boolean"
  ) {
    return null;
  }

  return {
    name,
    price,
    categoryId,
    isAvailable
  };
}

// Lấy danh sách thực đơn
app.get("/api/menu", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.name,
        m.price,
        m.category_id,
        m.is_available,
        c.name AS category_name
      FROM menu_items m
      LEFT JOIN categories c
        ON m.category_id = c.id
      ORDER BY m.id
    `);

    res.json(result.rows);
  } catch (err) {
    handleError(res, err, "Không thể tải thực đơn");
  }
});

// Thêm món
app.post("/api/menu", async (req, res) => {
  const data = validateMenu(req.body);

  if (!data) {
    return res.status(400).json({
      error: "Thông tin món ăn không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO menu_items
       (name, price, category_id, is_available)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.name,
        data.price,
        data.categoryId,
        data.isAvailable
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({
        error: "Danh mục món ăn không tồn tại"
      });
    }

    handleError(res, err, "Không thể thêm món");
  }
});

// Sửa món
app.put("/api/menu/:id", async (req, res) => {
  const id = validId(req.params.id);
  const data = validateMenu(req.body);

  if (!id || !data) {
    return res.status(400).json({
      error: "Thông tin món ăn không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `UPDATE menu_items
       SET name=$1,
           price=$2,
           category_id=$3,
           is_available=$4
       WHERE id=$5
       RETURNING *`,
      [
        data.name,
        data.price,
        data.categoryId,
        data.isAvailable,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy món ăn"
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23503") {
      return res.status(400).json({
        error: "Danh mục món ăn không tồn tại"
      });
    }

    handleError(res, err, "Không thể sửa món");
  }
});

// Xóa món
app.delete("/api/menu/:id", async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: "ID món ăn không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM menu_items
       WHERE id=$1
       RETURNING *`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy món ăn"
      });
    }

    res.json({
      message: "Xóa món thành công",
      item: result.rows[0]
    });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        error: "Món đã thuộc đơn hàng, hãy ngừng bán thay vì xóa"
      });
    }

    handleError(res, err, "Không thể xóa món");
  }
});

// ======================================
// 5. KHỞI ĐỘNG BACKEND
// ======================================

app.listen(3000, "0.0.0.0", () => {
  console.log("Backend running on port 3000");
});



const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json({ limit: "50kb" }));

const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: 5432,
  user: process.env.DB_USER || "restaurant_user",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "restaurant_db"
});

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function handleError(res, err, message) {
  if (err.code === "23505") {
    return res.status(409).json({ error: "Dữ liệu đã tồn tại" });
  }

  if (err.code === "23503") {
    return res.status(409).json({
      error: "Dữ liệu đang được sử dụng hoặc liên kết không hợp lệ"
    });
  }

  console.error(err);
  return res.status(500).json({ error: message });
}

// =====================================
// 1. KIỂM TRA KẾT NỐI
// =====================================

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

// =====================================
// 2. QUẢN LÝ BÀN
// =====================================

const tableStatuses = ["available", "occupied", "reserved"];

function validateTable(body = {}) {
  const tableNumber = validId(body.table_number);
  const capacity = validId(body.capacity);
  const status = body.status ?? "available";

  if (!tableNumber || !capacity || !tableStatuses.includes(status)) {
    return null;
  }

  return { tableNumber, capacity, status };
}

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
       VALUES ($1, $2, $3) RETURNING *`,
      [data.tableNumber, data.capacity, data.status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, "Không thể thêm bàn");
  }
});

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
       WHERE id=$4 RETURNING *`,
      [data.tableNumber, data.capacity, data.status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy bàn"
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleError(res, err, "Không thể sửa bàn");
  }
});

app.delete("/api/tables/:id", async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "ID bàn không hợp lệ" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM restaurant_tables WHERE id=$1 RETURNING *",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy bàn"
      });
    }

    res.json({ message: "Đã xóa bàn", table: result.rows[0] });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        error: "Không thể xóa bàn đã có đơn hàng liên quan"
      });
    }
    handleError(res, err, "Không thể xóa bàn");
  }
});

// =====================================
// 3. DANH MỤC MÓN ĂN
// =====================================

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

// =====================================
// 4. QUẢN LÝ THỰC ĐƠN
// =====================================

function validateMenu(body = {}) {
  const name = typeof body.name === "string"
    ? body.name.trim()
    : "";

  const price = Number(body.price);
  const categoryId = validId(body.category_id);
  const isAvailable = body.is_available ?? true;

  if (
    !name || name.length > 150 ||
    body.price === "" || body.price == null ||
    !Number.isFinite(price) || price < 0 ||
    price > 9999999999.99 ||
    !categoryId ||
    typeof isAvailable !== "boolean"
  ) {
    return null;
  }

  return { name, price, categoryId, isAvailable };
}

app.get("/api/menu", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.id, m.name, m.price, m.category_id,
             m.is_available, c.name AS category_name
      FROM menu_items m
      LEFT JOIN categories c ON c.id = m.category_id
      ORDER BY m.id
    `);

    res.json(result.rows);
  } catch (err) {
    handleError(res, err, "Không thể tải thực đơn");
  }
});

app.post("/api/menu", async (req, res) => {
  const data = validateMenu(req.body);

  if (!data) {
    return res.status(400).json({
      error: "Thông tin món không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO menu_items (name, price, category_id, is_available)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.price, data.categoryId, data.isAvailable]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, err, "Không thể thêm món");
  }
});

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
       SET name=$1, price=$2, category_id=$3, is_available=$4
       WHERE id=$5 RETURNING *`,
      [
        data.name, data.price,
        data.categoryId, data.isAvailable, id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy món ăn"
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    handleError(res, err, "Không thể sửa món");
  }
});

app.delete("/api/menu/:id", async (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: "ID món không hợp lệ"
    });
  }

  try {
    const result = await pool.query(
      "DELETE FROM menu_items WHERE id=$1 RETURNING *",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Không tìm thấy món ăn"
      });
    }

    res.json({
      message: "Đã xóa món",
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

// =====================================
// 5. DANH SÁCH ORDER
// =====================================

app.get("/api/orders", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id,
        o.table_id,
        t.table_number,
        o.status,
        o.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'menu_item_id', oi.menu_item_id,
              'name', m.name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price
            )
            ORDER BY oi.id
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) AS items,
        COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total
      FROM orders o
      JOIN restaurant_tables t ON t.id = o.table_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items m ON m.id = oi.menu_item_id
      GROUP BY o.id, t.table_number
      ORDER BY o.created_at DESC, o.id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    handleError(res, err, "Không thể tải danh sách Order");
  }
});

// =====================================
// 6. TẠO ORDER
// =====================================

app.post("/api/orders", async (req, res) => {
  const tableId = validId(req.body?.table_id);
  const rawItems = req.body?.items;

  if (
    !tableId || !Array.isArray(rawItems) ||
    rawItems.length < 1 || rawItems.length > 100
  ) {
    return res.status(400).json({
      error: "Vui lòng chọn bàn và ít nhất một món"
    });
  }

  const items = rawItems.map(item => ({
    menuId: validId(item?.menu_item_id),
    quantity: validId(item?.quantity)
  }));

  if (
    items.some(item =>
      !item.menuId || !item.quantity || item.quantity > 100
    ) ||
    new Set(items.map(item => item.menuId)).size !== items.length
  ) {
    return res.status(400).json({
      error: "Danh sách món hoặc số lượng không hợp lệ"
    });
  }

  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    const tableResult = await client.query(
      "SELECT * FROM restaurant_tables WHERE id=$1 FOR UPDATE",
      [tableId]
    );

    const table = tableResult.rows[0];

    if (!table) {
      const err = new Error("Không tìm thấy bàn");
      err.httpStatus = 404;
      throw err;
    }

    if (table.status !== "available") {
      const err = new Error("Bàn không còn trống");
      err.httpStatus = 409;
      throw err;
    }

    const menuIds = items.map(item => item.menuId);

    const menuResult = await client.query(
      `SELECT id, name, price, is_available
       FROM menu_items WHERE id=ANY($1::int[])
       FOR SHARE`,
      [menuIds]
    );

    const menuMap = new Map(
      menuResult.rows.map(item => [item.id, item])
    );

    for (const item of items) {
      const dish = menuMap.get(item.menuId);
      if (!dish || !dish.is_available) {
        const err = new Error(
          "Có món không tồn tại hoặc đã ngừng bán"
        );
        err.httpStatus = 409;
        throw err;
      }
    }

    const orderResult = await client.query(
      `INSERT INTO orders (table_id, status)
       VALUES ($1, 'pending') RETURNING *`,
      [tableId]
    );

    const order = orderResult.rows[0];
    let total = 0;

    for (const item of items) {
      const dish = menuMap.get(item.menuId);

      await client.query(
        `INSERT INTO order_items
         (order_id, menu_item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menuId, item.quantity, dish.price]
      );

      total += Number(dish.price) * item.quantity;
    }

    await client.query(
      `UPDATE restaurant_tables
       SET status='occupied' WHERE id=$1`,
      [tableId]
    );

    await client.query("COMMIT");
    inTransaction = false;

    res.status(201).json({
      message: "Tạo Order thành công",
      order_id: order.id,
      table_id: tableId,
      status: "pending",
      total
    });

  } catch (err) {
    if (inTransaction) {
      await client.query("ROLLBACK").catch(console.error);
    }

    if (err.httpStatus) {
      return res.status(err.httpStatus).json({
        error: err.message
      });
    }

    handleError(res, err, "Không thể tạo Order");
  } finally {
    client.release();
  }
});

// =====================================
// 7. BẾP XỬ LÝ ORDER - MỚI
// =====================================

const nextOrderStatus = {
  pending: "preparing",
  preparing: "served"
};

app.patch("/api/orders/:id/status", async (req, res) => {
  const id = validId(req.params.id);
  const requestedStatus = req.body?.status;

  if (
    !id ||
    !["preparing", "served"].includes(requestedStatus)
  ) {
    return res.status(400).json({
      error: "ID hoặc trạng thái không hợp lệ"
    });
  }

  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query("BEGIN");
    inTransaction = true;

    // Khóa Order để các yêu cầu đồng thời không làm sai trạng thái
    const orderResult = await client.query(
      "SELECT id, status FROM orders WHERE id=$1 FOR UPDATE",
      [id]
    );

    if (!orderResult.rows.length) {
      await client.query("ROLLBACK");
      inTransaction = false;
      return res.status(404).json({
        error: "Không tìm thấy Order"
      });
    }

    const currentStatus = orderResult.rows[0].status;

    if (nextOrderStatus[currentStatus] !== requestedStatus) {
      await client.query("ROLLBACK");
      inTransaction = false;

      return res.status(409).json({
        error: "Không thể chuyển trạng thái Order theo yêu cầu",
        current_status: currentStatus
      });
    }

    const updated = await client.query(
      `UPDATE orders
       SET status=$1
       WHERE id=$2
       RETURNING id, table_id, status, created_at`,
      [requestedStatus, id]
    );

    await client.query("COMMIT");
    inTransaction = false;

    res.json({
      message: requestedStatus === "preparing"
        ? "Bếp đã bắt đầu chế biến"
        : "Đơn đã được phục vụ",
      order: updated.rows[0]
    });

  } catch (err) {
    if (inTransaction) {
      await client.query("ROLLBACK").catch(console.error);
    }
    handleError(res, err, "Không thể cập nhật trạng thái Order");
  } finally {
    client.release();
  }
});

// =====================================
// 8. KHỞI ĐỘNG SERVER
// =====================================

app.listen(3000, "0.0.0.0", () => {
  console.log("Restaurant backend running on port 3000");
});



const express = require("express");

function createPaymentRouter(pool) {
  const router = express.Router();

  const methods = ["cash", "bank_transfer", "card"];

  function validId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }

  // ======================================
  // LẤY DANH SÁCH THANH TOÁN
  // ======================================

  router.get("/", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          p.id,
          p.order_id,
          p.amount,
          p.payment_method,
          p.paid_at,
          o.status AS order_status,
          t.table_number
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        JOIN restaurant_tables t ON t.id = o.table_id
        ORDER BY p.paid_at DESC, p.id DESC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Không thể tải lịch sử thanh toán"
      });
    }
  });

  // ======================================
  // THANH TOÁN ĐƠN HÀNG
  // ======================================

  router.post("/", async (req, res) => {
    const orderId = validId(req.body?.order_id);
    const method = req.body?.payment_method;

    if (!orderId || !methods.includes(method)) {
      return res.status(400).json({
        error: "Order hoặc phương thức thanh toán không hợp lệ"
      });
    }

    let client;
    let inTransaction = false;

    try {
      client = await pool.connect();

      await client.query("BEGIN");
      inTransaction = true;

      // Khóa Order để tránh thanh toán trùng
      const orderResult = await client.query(
        `SELECT id, table_id, status
         FROM orders
         WHERE id = $1
         FOR UPDATE`,
        [orderId]
      );

      if (!orderResult.rows.length) {
        await client.query("ROLLBACK");
        inTransaction = false;

        return res.status(404).json({
          error: "Không tìm thấy Order"
        });
      }

      const order = orderResult.rows[0];

      if (order.status !== "served") {
        await client.query("ROLLBACK");
        inTransaction = false;

        return res.status(409).json({
          error: "Chỉ được thanh toán Order đã phục vụ"
        });
      }

      // Tính tiền trực tiếp từ chi tiết Order.
      // Không lấy số tiền do frontend gửi.
      const amountResult = await client.query(
        `SELECT
           COUNT(*)::int AS item_count,
           COALESCE(
             SUM(quantity * unit_price), 0
           ) AS amount
         FROM order_items
         WHERE order_id = $1`,
        [orderId]
      );

      const { item_count, amount } = amountResult.rows[0];

      if (item_count === 0) {
        await client.query("ROLLBACK");
        inTransaction = false;

        return res.status(409).json({
          error: "Order chưa có món ăn"
        });
      }

      // Bảng payments có UNIQUE(order_id)
      // để không ghi nhận thanh toán trùng.
      const paymentResult = await client.query(
        `INSERT INTO payments
          (order_id, amount, payment_method)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [orderId, amount, method]
      );

      // Hoàn tất đơn
      await client.query(
        `UPDATE orders
         SET status = 'completed'
         WHERE id = $1`,
        [orderId]
      );

      // Kiểm tra không còn đơn chưa hoàn tất
      // trên cùng bàn trước khi giải phóng.
      const remaining = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM orders
         WHERE table_id = $1
           AND status NOT IN ('completed', 'cancelled')`,
        [order.table_id]
      );

      if (remaining.rows[0].count === 0) {
        await client.query(
          `UPDATE restaurant_tables
           SET status = 'available'
           WHERE id = $1`,
          [order.table_id]
        );
      }

      await client.query("COMMIT");
      inTransaction = false;

      return res.status(201).json({
        message: "Thanh toán thành công",
        payment: paymentResult.rows[0],
        order_id: orderId,
        order_status: "completed",
        table_released: remaining.rows[0].count === 0
      });

    } catch (error) {
      if (client && inTransaction) {
        await client.query("ROLLBACK").catch(console.error);
      }

      if (error.code === "23505") {
        return res.status(409).json({
          error: "Order này đã được thanh toán"
        });
      }

      console.error(error);

      return res.status(500).json({
        error: "Không thể hoàn tất thanh toán"
      });
    } finally {
      if (client) client.release();
    }
  });

  return router;
}

module.exports = createPaymentRouter;


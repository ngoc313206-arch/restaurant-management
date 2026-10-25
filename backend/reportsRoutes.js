
const express = require("express");

function createReportsRouter(pool) {
  const router = express.Router();

  // Tất cả kết quả doanh thu đều lấy từ payments.
  // Các khoảng ngày sử dụng ngày lưu tại PostgreSQL.

  // 1. Tổng quan hệ thống
  router.get("/summary", async (req, res) => {
    try {
      const [revenue, orders, tables, menu] = await Promise.all([
        pool.query(`
          SELECT
            COALESCE(SUM(amount), 0) AS total_revenue,
            COALESCE(SUM(amount) FILTER (
              WHERE paid_at::date = CURRENT_DATE
            ), 0) AS today_revenue,
            COALESCE(SUM(amount) FILTER (
              WHERE date_trunc('month', paid_at) =
                    date_trunc('month', CURRENT_TIMESTAMP)
            ), 0) AS month_revenue,
            COUNT(*)::int AS payment_count
          FROM payments
        `),
        pool.query(`
          SELECT
            COUNT(*)::int AS total_orders,
            COUNT(*) FILTER (
              WHERE status = 'completed'
            )::int AS completed_orders,
            COUNT(*) FILTER (
              WHERE status IN ('pending', 'preparing', 'served')
            )::int AS active_orders
          FROM orders
        `),
        pool.query(`
          SELECT
            COUNT(*)::int AS total_tables,
            COUNT(*) FILTER (
              WHERE status = 'available'
            )::int AS available_tables,
            COUNT(*) FILTER (
              WHERE status = 'occupied'
            )::int AS occupied_tables
          FROM restaurant_tables
        `),
        pool.query(`
          SELECT
            COUNT(*)::int AS total_items,
            COUNT(*) FILTER (
              WHERE is_available = true
            )::int AS available_items
          FROM menu_items
        `)
      ]);

      res.json({
        revenue: revenue.rows[0],
        orders: orders.rows[0],
        tables: tables.rows[0],
        menu: menu.rows[0]
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Không thể tải thống kê tổng quan"
      });
    }
  });

  // 2. Doanh thu 7 ngày gần nhất, kể cả ngày không có giao dịch
  router.get("/daily", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          to_char(d.day, 'YYYY-MM-DD') AS date,
          COALESCE(SUM(p.amount), 0) AS revenue,
          COUNT(p.id)::int AS transactions
        FROM generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        ) AS d(day)
        LEFT JOIN payments p
          ON p.paid_at >= d.day
         AND p.paid_at < d.day + INTERVAL '1 day'
        GROUP BY d.day
        ORDER BY d.day ASC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Không thể tải doanh thu theo ngày"
      });
    }
  });

  // 3. Doanh thu 6 tháng gần nhất
  router.get("/monthly", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          to_char(m.month, 'YYYY-MM') AS month,
          COALESCE(SUM(p.amount), 0) AS revenue,
          COUNT(p.id)::int AS transactions
        FROM generate_series(
          date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m(month)
        LEFT JOIN payments p
          ON p.paid_at >= m.month
         AND p.paid_at < m.month + INTERVAL '1 month'
        GROUP BY m.month
        ORDER BY m.month ASC
      `);

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Không thể tải doanh thu theo tháng"
      });
    }
  });

  // 4. Top món bán chạy, chỉ tính đơn đã thanh toán
  router.get("/top-items", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          oi.menu_item_id AS id,
          m.name,
          SUM(oi.quantity)::int AS quantity_sold,
          SUM(oi.quantity * oi.unit_price) AS revenue
        FROM order_items oi
        JOIN payments p ON p.order_id = oi.order_id
        JOIN menu_items m ON m.id = oi.menu_item_id
        GROUP BY oi.menu_item_id, m.name
        ORDER BY quantity_sold DESC, revenue DESC
        LIMIT 10
      `);

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Không thể tải món bán chạy"
      });
    }
  });

  return router;
}

module.exports = createReportsRouter;


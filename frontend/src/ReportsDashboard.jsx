
import { useEffect, useState } from "react";
import "./ReportsDashboard.css";

const money = value =>
  Number(value || 0).toLocaleString("vi-VN") + " đ";

function RevenueChart({ title, data, labelKey }) {
  const max = Math.max(
    1,
    ...data.map(item => Number(item.revenue))
  );

  return (
    <section className="report-chart">
      <h3>{title}</h3>

      <div className="report-bars">
        {data.map(item => {
          const revenue = Number(item.revenue);
          const height = revenue > 0
            ? Math.max(4, revenue / max * 100)
            : 0;

          return (
            <div className="report-bar-column" key={item[labelKey]}>
              <span className="report-bar-value">
                {money(revenue)}
              </span>

              <div className="report-bar-track">
                <div
                  className="report-bar-fill"
                  style={{ height: `${height}%` }}
                  title={money(revenue)}
                />
              </div>

              <span className="report-bar-label">
                {labelKey === "date"
                  ? item.date.slice(5)
                  : item.month.slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ReportsDashboard() {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [topItems, setTopItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function requestJSON(url) {
    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Không tải được báo cáo");
    }

    return result;
  }

  async function loadReports() {
    const [summaryData, dailyData, monthlyData, topData] =
      await Promise.all([
        requestJSON("/api/reports/summary"),
        requestJSON("/api/reports/daily"),
        requestJSON("/api/reports/monthly"),
        requestJSON("/api/reports/top-items")
      ]);

    setSummary(summaryData);
    setDaily(dailyData);
    setMonthly(monthlyData);
    setTopItems(topData);
  }

  useEffect(() => {
    loadReports()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function refreshReports() {
    if (refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      await loadReports();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  const cards = summary ? [
    {
      label: "Tổng doanh thu",
      value: money(summary.revenue.total_revenue)
    },
    {
      label: "Doanh thu hôm nay",
      value: money(summary.revenue.today_revenue)
    },
    {
      label: "Doanh thu tháng này",
      value: money(summary.revenue.month_revenue)
    },
    {
      label: "Giao dịch thanh toán",
      value: summary.revenue.payment_count
    },
    {
      label: "Order hoàn thành",
      value: summary.orders.completed_orders
    },
    {
      label: "Order đang hoạt động",
      value: summary.orders.active_orders
    },
    {
      label: "Bàn đang sử dụng",
      value: summary.tables.occupied_tables
    },
    {
      label: "Món đang bán",
      value: summary.menu.available_items
    }
  ] : [];

  return (
    <section className="reports-dashboard" id="reports-dashboard">
      <div className="reports-heading">
        <div>
          <h2>Thống kê và báo cáo doanh thu</h2>
          <p>Dữ liệu từ PostgreSQL — chỉ tính giao dịch đã thanh toán</p>
        </div>

        <button
          type="button"
          onClick={refreshReports}
          disabled={refreshing}
        >
          {refreshing ? "Đang cập nhật..." : "Làm mới báo cáo"}
        </button>
      </div>

      {error && <p className="reports-error" role="alert">{error}</p>}

      {loading ? (
        <p>Đang tải báo cáo...</p>
      ) : (
        <>
          <div className="reports-stats">
            {cards.map(card => (
              <article key={card.label}>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>

          <div className="reports-charts">
            <RevenueChart
              title="Doanh thu 7 ngày gần nhất"
              data={daily}
              labelKey="date"
            />
            <RevenueChart
              title="Doanh thu 6 tháng gần nhất"
              data={monthly}
              labelKey="month"
            />
          </div>

          <section className="reports-top-items">
            <h3>Top 10 món bán chạy</h3>

            {topItems.length === 0 ? (
              <p>Chưa có món ăn nào trong các đơn đã thanh toán.</p>
            ) : (
              <div className="reports-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Tên món</th>
                      <th>Số lượng bán</th>
                      <th>Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{item.name}</td>
                        <td>{item.quantity_sold}</td>
                        <td>{money(item.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}


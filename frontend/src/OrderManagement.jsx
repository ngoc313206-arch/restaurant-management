
import { useEffect, useState } from "react";
import "./OrderManagement.css";

const money = value =>
  Number(value).toLocaleString("vi-VN") + " đ";

const statusLabels = {
  pending: "Chờ xử lý",
  preparing: "Đang chế biến",
  served: "Đã phục vụ",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy"
};

export default function OrderManagement({ onOrderCreated }) {
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);

  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState({});

  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [kitchenFilter, setKitchenFilter] = useState("active");

  async function requestJSON(url, options) {
    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Yêu cầu thất bại");
    }

    return result;
  }

  async function refresh() {
    const [tableData, menuData, orderData] = await Promise.all([
      requestJSON("/api/tables"),
      requestJSON("/api/menu"),
      requestJSON("/api/orders")
    ]);

    setTables(tableData);
    setMenu(menuData);
    setOrders(orderData);
  }

  useEffect(() => {
    refresh()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function changeQuantity(id, change) {
    setCart(previous => {
      const next = { ...previous };

      const quantity = Math.max(
        0,
        Math.min(100, (next[id] || 0) + change)
      );

      if (quantity === 0) {
        delete next[id];
      } else {
        next[id] = quantity;
      }

      return next;
    });
  }

  const selectedItems = menu
    .filter(item => item.is_available && cart[item.id] > 0)
    .map(item => ({
      ...item,
      quantity: cart[item.id]
    }));

  const total = selectedItems.reduce(
    (sum, item) =>
      sum + Number(item.price) * item.quantity,
    0
  );

  async function createOrder() {
    if (saving) return;

    if (!tableId || selectedItems.length === 0) {
      setError("Vui lòng chọn bàn và ít nhất một món");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await requestJSON("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          table_id: Number(tableId),
          items: selectedItems.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity
          }))
        })
      });

      setCart({});
      setTableId("");

      setMessage(
        `Tạo Order #${result.order_id} thành công — ${money(result.total)}`
      );

      await refresh();

      if (onOrderCreated) {
        await onOrderCreated();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // =====================================
  // BẾP CẬP NHẬT TRẠNG THÁI
  // =====================================

  async function changeOrderStatus(order, nextStatus) {
    if (updatingId !== null) return;

    const question = nextStatus === "preparing"
      ? `Bắt đầu chế biến Order #${order.id}?`
      : `Xác nhận Order #${order.id} đã được phục vụ?`;

    if (!window.confirm(question)) return;

    setUpdatingId(order.id);
    setError("");
    setMessage("");

    try {
      const result = await requestJSON(
        `/api/orders/${order.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus
          })
        }
      );

      setMessage(result.message);
      await refresh();

    } catch (err) {
      setError(err.message);

      // Đọc lại trạng thái nếu nhân viên khác đã cập nhật
      await refresh().catch(console.error);
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingOrders = orders.filter(
    order => order.status === "pending"
  );

  const preparingOrders = orders.filter(
    order => order.status === "preparing"
  );

  const servedOrders = orders.filter(
    order => order.status === "served"
  );

  const filteredOrders = orders.filter(order => {
    if (kitchenFilter === "active") {
      return ["pending", "preparing"].includes(order.status);
    }
    if (kitchenFilter === "all") return true;
    return order.status === kitchenFilter;
  });

  return (
    <section className="order-management" id="order-management">

      {/* =========================
          TẠO ORDER
      ========================= */}

      <h2>Tạo Order mới</h2>

      {loading && <p>Đang tải đơn hàng...</p>}

      {error && (
        <p className="order-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="order-success" role="status">
          {message}
        </p>
      )}

      <div className="order-panel">
        <label className="order-table-label">
          Chọn bàn đang trống

          <select
            value={tableId}
            onChange={event => setTableId(event.target.value)}
          >
            <option value="">-- Chọn bàn --</option>

            {tables
              .filter(table => table.status === "available")
              .map(table => (
                <option key={table.id} value={table.id}>
                  Bàn {table.table_number} — {table.capacity} người
                </option>
              ))}
          </select>
        </label>

        <h3>Chọn món ăn</h3>

        <div className="order-dishes">
          {menu
            .filter(item => item.is_available)
            .map(item => (
              <article key={item.id} className="order-dish">
                <strong>{item.name}</strong>
                <span>{item.category_name}</span>
                <b>{money(item.price)}</b>

                <div className="order-quantity">
                  <button
                    type="button"
                    disabled={!cart[item.id]}
                    onClick={() => changeQuantity(item.id, -1)}
                  >
                    −
                  </button>

                  <span>{cart[item.id] || 0}</span>

                  <button
                    type="button"
                    disabled={(cart[item.id] || 0) >= 100}
                    onClick={() => changeQuantity(item.id, 1)}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
        </div>

        <div className="order-summary">
          <h3>Giỏ gọi món</h3>

          {selectedItems.length === 0 ? (
            <p>Chưa chọn món ăn nào.</p>
          ) : (
            <div className="order-lines">
              {selectedItems.map(item => (
                <div key={item.id}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <strong>
                    {money(Number(item.price) * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>
          )}

          <div className="order-total">
            <strong>Tổng tiền</strong>
            <strong>{money(total)}</strong>
          </div>

          <button
            type="button"
            className="order-submit"
            disabled={saving || !tableId || !selectedItems.length}
            onClick={createOrder}
          >
            {saving ? "Đang tạo đơn..." : "Xác nhận Order"}
          </button>
        </div>
      </div>

      {/* =========================
          BẢNG ĐIỀU KHIỂN BẾP
      ========================= */}

      <div className="kitchen-header">
        <div>
          <h2>Bếp xử lý Order</h2>
          <p>Theo dõi và cập nhật tiến độ chế biến</p>
        </div>

        <button
          type="button"
          className="kitchen-refresh"
          onClick={() => {
            setError("");
            refresh().catch(err => setError(err.message));
          }}
        >
          Làm mới danh sách
        </button>
      </div>

      <div className="kitchen-stats">
        <article>
          <strong>{pendingOrders.length}</strong>
          <span>Chờ xử lý</span>
        </article>

        <article>
          <strong>{preparingOrders.length}</strong>
          <span>Đang chế biến</span>
        </article>

        <article>
          <strong>{servedOrders.length}</strong>
          <span>Đã phục vụ</span>
        </article>
      </div>

      <div className="kitchen-toolbar">
        <label htmlFor="kitchen-filter">Lọc đơn hàng</label>

        <select
          id="kitchen-filter"
          value={kitchenFilter}
          onChange={event => setKitchenFilter(event.target.value)}
        >
          <option value="active">Đơn cần xử lý</option>
          <option value="pending">Chờ xử lý</option>
          <option value="preparing">Đang chế biến</option>
          <option value="served">Đã phục vụ</option>
          <option value="all">Tất cả đơn</option>
        </select>
      </div>

      <div className="order-history">
        {filteredOrders.length === 0 && (
          <p>Không có Order nào trong nhóm này.</p>
        )}

        {filteredOrders.map(order => (
          <article key={order.id} className="order-history-card">
            <div className="order-history-title">
              <strong>
                Order #{order.id} — Bàn {order.table_number}
              </strong>

              <span className={`kitchen-status kitchen-${order.status}`}>
                {statusLabels[order.status] || order.status}
              </span>
            </div>

            <p>
              {new Date(order.created_at).toLocaleString("vi-VN")}
            </p>

            <div className="kitchen-order-items">
              {order.items.map(item => (
                <div key={item.id} className="order-history-item">
                  <span>
                    {item.name} × {item.quantity}
                  </span>

                  <span>
                    {money(Number(item.unit_price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="order-history-total">
              Tổng: {money(order.total)}
            </div>

            {order.status === "pending" && (
              <button
                type="button"
                className="kitchen-start"
                disabled={updatingId !== null}
                onClick={() => changeOrderStatus(order, "preparing")}
              >
                {updatingId === order.id
                  ? "Đang cập nhật..."
                  : "Bắt đầu chế biến"}
              </button>
            )}

            {order.status === "preparing" && (
              <button
                type="button"
                className="kitchen-finish"
                disabled={updatingId !== null}
                onClick={() => changeOrderStatus(order, "served")}
              >
                {updatingId === order.id
                  ? "Đang cập nhật..."
                  : "Xác nhận đã phục vụ"}
              </button>
            )}

            {order.status === "served" && (
              <p className="kitchen-completed-text">
                Đã phục vụ — chờ thanh toán
              </p>
            )}
          </article>
        ))}
      </div>

    </section>
  );
}


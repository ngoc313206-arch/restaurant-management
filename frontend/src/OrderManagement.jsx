
import { useEffect, useState } from "react";
import "./OrderManagement.css";

const money = value =>
  Number(value).toLocaleString("vi-VN") + " đ";

export default function OrderManagement({ onOrderCreated }) {
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tableId, setTableId] = useState("");
  const [cart, setCart] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function getJSON(url) {
    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Không thể tải dữ liệu");
    }
    return result;
  }

  async function refresh() {
    const [tableData, menuData, orderData] = await Promise.all([
      getJSON("/api/tables"),
      getJSON("/api/menu"),
      getJSON("/api/orders")
    ]);

    setTables(tableData);
    setMenu(menuData);
    setOrders(orderData);
  }

  useEffect(() => {
    refresh().catch(err => setError(err.message));
  }, []);

  function changeQuantity(id, change) {
    setCart(previous => {
      const next = { ...previous };
      const quantity = Math.max(0, Math.min(100,
        (next[id] || 0) + change
      ));

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
    (sum, item) => sum + Number(item.price) * item.quantity,
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
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_id: Number(tableId),
          items: selectedItems.map(item => ({
            menu_item_id: item.id,
            quantity: item.quantity
          }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Tạo Order thất bại");
      }

      setMessage(`Đã tạo Order #${result.order_id} — ${money(result.total)}`);
      setCart({});
      setTableId("");

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

  return (
    <section className="order-management" id="order-management">
      <h2>Tạo Order mới</h2>

      {error && <p className="order-error" role="alert">{error}</p>}
      {message && <p className="order-success" role="status">{message}</p>}

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
          {menu.filter(item => item.is_available).map(item => (
            <article key={item.id} className="order-dish">
              <strong>{item.name}</strong>
              <span>{item.category_name}</span>
              <b>{money(item.price)}</b>

              <div className="order-quantity">
                <button
                  type="button"
                  onClick={() => changeQuantity(item.id, -1)}
                  disabled={!cart[item.id]}
                >
                  −
                </button>
                <span>{cart[item.id] || 0}</span>
                <button
                  type="button"
                  onClick={() => changeQuantity(item.id, 1)}
                  disabled={(cart[item.id] || 0) >= 100}
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
                  <span>{item.name} × {item.quantity}</span>
                  <strong>{money(Number(item.price) * item.quantity)}</strong>
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

      <h2>Danh sách Order</h2>

      <div className="order-history">
        {orders.length === 0 && <p>Chưa có đơn hàng nào.</p>}

        {orders.map(order => (
          <article key={order.id} className="order-history-card">
            <div className="order-history-title">
              <strong>Order #{order.id} — Bàn {order.table_number}</strong>
              <span>{order.status}</span>
            </div>

            <p>
              {new Date(order.created_at).toLocaleString("vi-VN")}
            </p>

            {order.items.map(item => (
              <div className="order-history-item" key={item.id}>
                <span>{item.name} × {item.quantity}</span>
                <span>{money(Number(item.unit_price) * item.quantity)}</span>
              </div>
            ))}

            <div className="order-history-total">
              Tổng: {money(order.total)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}



import { useEffect, useState } from "react";
import "./PaymentManagement.css";

const money = value =>
  Number(value).toLocaleString("vi-VN") + " đ";

const paymentNames = {
  cash: "Tiền mặt",
  bank_transfer: "Chuyển khoản",
  card: "Thẻ"
};

export default function PaymentManagement({ onPaymentSuccess }) {
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [receiptId, setReceiptId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function requestJSON(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Yêu cầu thất bại");
    }

    return data;
  }

  async function refresh() {
    const [orderData, paymentData] = await Promise.all([
      requestJSON("/api/orders"),
      requestJSON("/api/payments")
    ]);

    setOrders(orderData);
    setPayments(paymentData);
  }

  useEffect(() => {
    refresh()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const servedOrders = orders.filter(
    order => order.status === "served"
  );

  const selectedOrder = orders.find(
    order => order.id === Number(selectedOrderId)
  );

  const receiptPayment = payments.find(
    payment => payment.id === receiptId
  );

  const receiptOrder = receiptPayment
    ? orders.find(order => order.id === receiptPayment.order_id)
    : null;

  function showReceipt(payment) {
    setReceiptId(payment.id);
    document.getElementById("receipt-print")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  }

  async function payOrder() {
    if (!selectedOrder || saving) return;

    const confirmed = window.confirm(
      `Xác nhận đã nhận ${money(selectedOrder.total)} ` +
      `cho Order #${selectedOrder.id} ` +
      `bằng ${paymentNames[paymentMethod]}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await requestJSON("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          payment_method: paymentMethod
        })
      });

      setMessage(
        `Thanh toán Order #${selectedOrder.id} thành công. ` +
        (result.table_released
          ? "Bàn đã được giải phóng."
          : "Bàn vẫn có đơn đang mở.")
      );

      setSelectedOrderId("");

      await refresh();
      setReceiptId(result.payment.id);

      if (onPaymentSuccess) {
        await onPaymentSuccess();
      }

    } catch (err) {
      setError(err.message);
      await refresh().catch(console.error);
    } finally {
      setSaving(false);
    }
  }

  const totalRevenue = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  return (
    <section className="payment-management" id="payment-management">
      <div className="payment-header">
        <div>
          <h2>Thu ngân và thanh toán</h2>
          <p>Thanh toán Order đã phục vụ và xuất hóa đơn</p>
        </div>

        <button
          type="button"
          className="payment-refresh"
          onClick={() => {
            setError("");
            refresh().catch(err => setError(err.message));
          }}
        >
          Làm mới
        </button>
      </div>

      {loading && <p>Đang tải dữ liệu thanh toán...</p>}

      {error && (
        <p className="payment-error" role="alert">{error}</p>
      )}

      {message && (
        <p className="payment-success" role="status">{message}</p>
      )}

      <div className="payment-stats">
        <article>
          <strong>{servedOrders.length}</strong>
          <span>Đơn chờ thanh toán</span>
        </article>

        <article>
          <strong>{payments.length}</strong>
          <span>Giao dịch đã ghi nhận</span>
        </article>

        <article>
          <strong>{money(totalRevenue)}</strong>
          <span>Tổng thanh toán đã ghi nhận</span>
        </article>
      </div>

      <div className="payment-panel">
        <h3>Tạo thanh toán</h3>

        <label className="payment-field">
          Chọn Order đã phục vụ
          <select
            value={selectedOrderId}
            onChange={event => setSelectedOrderId(event.target.value)}
          >
            <option value="">-- Chọn Order --</option>
            {servedOrders.map(order => (
              <option key={order.id} value={order.id}>
                Order #{order.id} — Bàn {order.table_number} —
                {" "}{money(order.total)}
              </option>
            ))}
          </select>
        </label>

        {selectedOrder && (
          <div className="payment-bill">
            <h3>
              Hóa đơn Order #{selectedOrder.id}
            </h3>
            <p>Bàn số {selectedOrder.table_number}</p>

            <div className="payment-bill-items">
              {selectedOrder.items.map(item => (
                <div key={item.id}>
                  <span>{item.name} × {item.quantity}</span>
                  <strong>
                    {money(Number(item.unit_price) * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="payment-bill-total">
              <strong>Phải thu</strong>
              <strong>{money(selectedOrder.total)}</strong>
            </div>
          </div>
        )}

        <label className="payment-field">
          Phương thức thanh toán
          <select
            value={paymentMethod}
            onChange={event => setPaymentMethod(event.target.value)}
          >
            <option value="cash">Tiền mặt</option>
            <option value="bank_transfer">Chuyển khoản</option>
            <option value="card">Thẻ</option>
          </select>
        </label>

        <p className="payment-warning">
          Chỉ nhấn xác nhận sau khi thu ngân đã nhận đủ tiền.
          Chức năng này không tự xử lý giao dịch ngân hàng.
        </p>

        <button
          type="button"
          className="payment-submit"
          disabled={!selectedOrder || saving}
          onClick={payOrder}
        >
          {saving ? "Đang xử lý..." : "Xác nhận đã nhận tiền"}
        </button>
      </div>

      <h2>Lịch sử thanh toán</h2>

      <div className="payment-history">
        {payments.length === 0 && (
          <p>Chưa có giao dịch thanh toán nào.</p>
        )}

        {payments.map(payment => (
          <article key={payment.id}>
            <div className="payment-history-heading">
              <strong>Hóa đơn #{payment.id}</strong>
              <span>Order #{payment.order_id}</span>
            </div>

            <p>Bàn {payment.table_number}</p>
            <p>{paymentNames[payment.payment_method]}</p>
            <p>
              {new Date(payment.paid_at).toLocaleString("vi-VN")}
            </p>

            <strong className="payment-history-amount">
              {money(payment.amount)}
            </strong>

            <button
              type="button"
              onClick={() => showReceipt(payment)}
            >
              Xem hóa đơn
            </button>
          </article>
        ))}
      </div>

      {receiptPayment && receiptOrder && (
        <div className="receipt-wrapper">
          <div className="receipt-print" id="receipt-print">
            <div className="receipt-title">
              <h2>NHÀ HÀNG</h2>
              <p>HÓA ĐƠN THANH TOÁN</p>
            </div>

            <p>Mã hóa đơn: #{receiptPayment.id}</p>
            <p>Mã Order: #{receiptOrder.id}</p>
            <p>Bàn: {receiptOrder.table_number}</p>
            <p>
              Thời gian:{" "}
              {new Date(receiptPayment.paid_at).toLocaleString("vi-VN")}
            </p>

            <hr />

            <div className="receipt-items">
              {receiptOrder.items.map(item => (
                <div key={item.id}>
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>
                    {money(Number(item.unit_price) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <hr />

            <div className="receipt-total">
              <strong>TỔNG CỘNG</strong>
              <strong>{money(receiptPayment.amount)}</strong>
            </div>

            <p>
              Thanh toán:{" "}
              {paymentNames[receiptPayment.payment_method]}
            </p>
            <p className="receipt-thanks">
              Cảm ơn quý khách và hẹn gặp lại!
            </p>
          </div>

          <button
            type="button"
            className="receipt-print-button"
            onClick={() => window.print()}
          >
            In / Lưu PDF hóa đơn
          </button>
        </div>
      )}
    </section>
  );
}


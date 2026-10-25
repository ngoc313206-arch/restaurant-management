import ReportsDashboard from "./ReportsDashboard";

import { useEffect, useState } from "react";
import App from "./App";
import OrderManagement from "./OrderManagement";
import PaymentManagement from "./PaymentManagement";
import "./RolePortal.css";

const roleNames = {
  admin: "Quản trị viên",
  manager: "Quản lý nhà hàng",
  waiter: "Nhân viên phục vụ",
  chef: "Nhân viên bếp",
  cashier: "Thu ngân"
};

async function api(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Yêu cầu thất bại");
  }

  return result;
}

function KitchenScreen() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

  async function refresh() {
    const data = await api("/api/orders");
    setOrders(data);
  }

  useEffect(() => {
    refresh().catch(err => setError(err.message));
  }, []);

  async function changeStatus(order, status) {
    if (busy !== null) return;

    setBusy(order.id);
    setError("");

    try {
      await api(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      await refresh();
    } catch (err) {
      setError(err.message);
      await refresh().catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  const active = orders.filter(order =>
    ["pending", "preparing"].includes(order.status)
  );

  return (
    <section className="role-section">
      <div className="role-heading">
        <h2>Bếp xử lý Order</h2>
        <button onClick={() => refresh().catch(err => setError(err.message))}>
          Làm mới
        </button>
      </div>

      {error && <p className="role-error">{error}</p>}

      <div className="role-orders">
        {active.length === 0 && <p>Không có Order đang chờ xử lý.</p>}

        {active.map(order => (
          <article key={order.id}>
            <h3>Order #{order.id} — Bàn {order.table_number}</h3>

            <p>
              {order.status === "pending"
                ? "Chờ xử lý"
                : "Đang chế biến"}
            </p>

            {order.items.map(item => (
              <div className="role-line" key={item.id}>
                <span>{item.name}</span>
                <strong>× {item.quantity}</strong>
              </div>
            ))}

            <button
              disabled={busy !== null}
              onClick={() => changeStatus(
                order,
                order.status === "pending" ? "preparing" : "served"
              )}
            >
              {busy === order.id
                ? "Đang cập nhật..."
                : order.status === "pending"
                  ? "Bắt đầu chế biến"
                  : "Xác nhận đã phục vụ"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function StaffManagement() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "waiter"
  });

  async function refresh() {
    setUsers(await api("/api/auth/users"));
  }

  useEffect(() => {
    refresh().catch(err => setError(err.message));
  }, []);

  async function createUser(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      setForm({
        full_name: "",
        username: "",
        password: "",
        role: "waiter"
      });

      setMessage("Đã tạo tài khoản nhân viên");
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="role-section">
      <h2>Quản lý tài khoản nhân viên</h2>

      {error && <p className="role-error">{error}</p>}
      {message && <p className="role-success">{message}</p>}

      <form className="staff-form" onSubmit={createUser}>
        <label>
          Họ tên
          <input
            required
            maxLength="100"
            value={form.full_name}
            onChange={e => setForm({
              ...form, full_name: e.target.value
            })}
          />
        </label>

        <label>
          Tên đăng nhập
          <input
            required
            pattern="[a-z0-9_]{3,50}"
            placeholder="Ví dụ: phucvu01"
            value={form.username}
            onChange={e => setForm({
              ...form, username: e.target.value.toLowerCase()
            })}
          />
        </label>

        <label>
          Mật khẩu mới
          <input
            type="password"
            required
            minLength="12"
            autoComplete="new-password"
            value={form.password}
            onChange={e => setForm({
              ...form, password: e.target.value
            })}
          />
        </label>

        <label>
          Vai trò
          <select
            value={form.role}
            onChange={e => setForm({
              ...form, role: e.target.value
            })}
          >
            <option value="manager">Quản lý nhà hàng</option>
            <option value="waiter">Nhân viên phục vụ</option>
            <option value="chef">Nhân viên bếp</option>
            <option value="cashier">Thu ngân</option>
          </select>
        </label>

        <button disabled={saving} type="submit">
          {saving ? "Đang lưu..." : "Tạo tài khoản"}
        </button>
      </form>

      <h3>Danh sách nhân viên</h3>

      <div className="staff-list">
        {users.map(user => (
          <div key={user.id} className="role-line">
            <span>
              {user.full_name} ({user.username})
            </span>
            <strong>{roleNames[user.role] || user.role}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RolePortal() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    api("/api/auth/me")
      .then(result => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  async function login(event) {
    event.preventDefault();
    if (loggingIn) return;

    setLoggingIn(true);
    setError("");

    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      setUser(result.user);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setPassword("");
    }
  }

  if (checking) {
    return <div className="login-page">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (!user) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <div className="login-symbol">🍽️</div>
          <h1>Restaurant Management</h1>
          <p>Đăng nhập hệ thống quản lý nhà hàng</p>

          {error && <p className="role-error">{error}</p>}

          <label>
            Tên đăng nhập
            <input
              required
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </label>

          <label>
            Mật khẩu
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>

          <button disabled={loggingIn} type="submit">
            {loggingIn ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="role-app">
      <nav className="role-topbar">
        <div>
          <strong>Restaurant Management</strong>
          <span>
            {user.full_name} — {roleNames[user.role]}
          </span>
        </div>

        <button onClick={logout}>Đăng xuất</button>
      </nav>

      {["admin", "manager"].includes(user.role) && (
        <>
          <App />
          <ReportsDashboard />
          {user.role === "admin" && <StaffManagement />}
        </>
      )}

      {user.role === "waiter" && (
        <main className="role-section">
          <h2>Nhân viên phục vụ — Tạo Order</h2>
          <OrderManagement />
        </main>
      )}

      {user.role === "chef" && <KitchenScreen />}

      {user.role === "cashier" && (
        <main className="role-section">
          <PaymentManagement />
        </main>
      )}
    </div>
  );
}


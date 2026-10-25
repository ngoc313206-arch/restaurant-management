
import { useEffect, useState } from "react";
import "./StaffAccessManagement.css";

const roleLabels = {
  admin: "Admin",
  manager: "Quản lý",
  waiter: "Phục vụ",
  chef: "Bếp",
  cashier: "Thu ngân"
};

export default function StaffAccessManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function api(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Yêu cầu thất bại");
    }

    return data;
  }

  async function loadUsers() {
    const data = await api("/api/auth/users");
    setUsers(data);
  }

  useEffect(() => {
    loadUsers()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function changeStatus(user) {
    if (busyId !== null) return;

    const nextStatus = !user.is_active;
    const action = nextStatus ? "mở khóa" : "khóa";

    if (!window.confirm(
      `Bạn chắc chắn muốn ${action} tài khoản "${user.username}"?`
    )) {
      return;
    }

    setBusyId(user.id);
    setError("");
    setMessage("");

    try {
      const result = await api(
        `/api/auth/users/${user.id}/active`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            is_active: nextStatus
          })
        }
      );

      setMessage(result.message);
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const activeCount = users.filter(u => u.is_active).length;
  const lockedCount = users.filter(u => !u.is_active).length;

  return (
    <section className="staff-access">
      <div className="staff-access-header">
        <div>
          <h2>Quản lý trạng thái tài khoản</h2>
          <p>Khóa, mở khóa và thu hồi phiên nhân viên</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError("");
            loadUsers().catch(err => setError(err.message));
          }}
        >
          Làm mới
        </button>
      </div>

      {loading && <p>Đang tải tài khoản...</p>}

      {error && (
        <p className="staff-access-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="staff-access-success" role="status">
          {message}
        </p>
      )}

      <div className="staff-access-stats">
        <article>
          <strong>{users.length}</strong>
          <span>Tổng tài khoản</span>
        </article>
        <article>
          <strong>{activeCount}</strong>
          <span>Đang hoạt động</span>
        </article>
        <article>
          <strong>{lockedCount}</strong>
          <span>Đã khóa</span>
        </article>
      </div>

      <div className="staff-access-table-wrapper">
        <table className="staff-access-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Username</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.username}</td>
                <td>{roleLabels[user.role] || user.role}</td>
                <td>
                  <span className={
                    user.is_active
                      ? "staff-status-active"
                      : "staff-status-locked"
                  }>
                    {user.is_active ? "Hoạt động" : "Đã khóa"}
                  </span>
                </td>
                <td>
                  {user.role === "admin" ? (
                    <span className="staff-protected">
                      Tài khoản quản trị
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId !== null}
                      className={
                        user.is_active
                          ? "staff-lock-button"
                          : "staff-unlock-button"
                      }
                      onClick={() => changeStatus(user)}
                    >
                      {busyId === user.id
                        ? "Đang xử lý..."
                        : user.is_active
                          ? "Khóa"
                          : "Mở khóa"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


import { useEffect, useState } from "react";
import "./App.css";

const emptyForm = {
  table_number: "",
  capacity: 2,
  status: "available"
};

const statusLabels = {
  available: "Còn trống",
  occupied: "Đang sử dụng",
  reserved: "Đã đặt trước"
};

function App() {
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const [tablesResponse, menuResponse] = await Promise.all([
      fetch("/api/tables"),
      fetch("/api/menu")
    ]);

    if (!tablesResponse.ok || !menuResponse.ok) {
      throw new Error("Không thể tải dữ liệu nhà hàng");
    }

    const [tableData, menuData] = await Promise.all([
      tablesResponse.json(),
      menuResponse.json()
    ]);

    setTables(tableData);
    setMenu(menuData);
  }

  useEffect(() => {
    loadData().catch(err => setError(err.message));
  }, []);

  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  function editTable(table) {
    setEditingId(table.id);
    setForm({
      table_number: table.table_number,
      capacity: table.capacity,
      status: table.status
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTable(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const url = editingId
        ? `/api/tables/${editingId}`
        : "/api/tables";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_number: Number(form.table_number),
          capacity: Number(form.capacity),
          status: form.status
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể lưu bàn");
      }

      await loadData();
      setMessage(editingId ? "Cập nhật bàn thành công" : "Thêm bàn thành công");
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTable(table) {
    if (!window.confirm(`Bạn có chắc muốn xóa Bàn ${table.table_number}?`)) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/tables/${table.id}`, {
        method: "DELETE"
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa bàn");
      }

      await loadData();
      if (editingId === table.id) resetForm();
      setMessage(`Đã xóa Bàn ${table.table_number}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Hệ thống Quản lý Nhà hàng</h1>
        <p>Restaurant Management / Order System</p>
      </header>

      <section className="stats">
        <article>
          <h2>{tables.length}</h2>
          <p>Tổng số bàn</p>
        </article>
        <article>
          <h2>{tables.filter(t => t.status === "available").length}</h2>
          <p>Bàn còn trống</p>
        </article>
        <article>
          <h2>{menu.length}</h2>
          <p>Món trong thực đơn</p>
        </article>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      <section className="management-form">
        <h2>{editingId ? "Chỉnh sửa bàn ăn" : "Thêm bàn ăn"}</h2>

        <form onSubmit={saveTable}>
          <label>
            Số bàn
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.table_number}
              onChange={e => setForm({
                ...form,
                table_number: e.target.value
              })}
            />
          </label>

          <label>
            Sức chứa
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.capacity}
              onChange={e => setForm({
                ...form,
                capacity: e.target.value
              })}
            />
          </label>

          <label>
            Trạng thái
            <select
              value={form.status}
              onChange={e => setForm({
                ...form,
                status: e.target.value
              })}
            >
              <option value="available">Còn trống</option>
              <option value="occupied">Đang sử dụng</option>
              <option value="reserved">Đã đặt trước</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm bàn"}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Hủy
              </button>
            )}
          </div>
        </form>
      </section>

      <h2>Danh sách bàn ăn</h2>
      <section className="tables">
        {tables.map(table => (
          <article key={table.id}>
            <h3>Bàn {table.table_number}</h3>
            <p>Sức chứa: {table.capacity} người</p>
            <p className={`status-${table.status}`}>
              {statusLabels[table.status] || table.status}
            </p>

            <div className="table-actions">
              <button className="edit-button" onClick={() => editTable(table)}>
                Sửa
              </button>
              <button className="delete-button" onClick={() => deleteTable(table)}>
                Xóa
              </button>
            </div>
          </article>
        ))}
      </section>

      <h2>Thực đơn nhà hàng</h2>
      <section className="menu">
        {menu.map(item => (
          <article key={item.id}>
            <h3>{item.name}</h3>
            <p>{item.category_name}</p>
            <strong>{Number(item.price).toLocaleString("vi-VN")} đ</strong>
          </article>
        ))}
      </section>
    </div>
  );
}

export default App;

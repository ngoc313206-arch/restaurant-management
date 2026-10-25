
import { useEffect, useState } from "react";
import OrderManagement from "./OrderManagement";
import "./App.css";

const emptyTableForm = {
  table_number: "",
  capacity: 2,
  status: "available"
};

const emptyMenuForm = {
  name: "",
  price: "",
  category_id: "",
  is_available: true
};

const statusLabels = {
  available: "Còn trống",
  occupied: "Đang sử dụng",
  reserved: "Đã đặt trước"
};

const money = value =>
  Number(value).toLocaleString("vi-VN") + " đ";

function App() {
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ ...emptyTableForm });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [menuForm, setMenuForm] = useState({ ...emptyMenuForm });
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuSaving, setMenuSaving] = useState(false);

  async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Yêu cầu thất bại");
    }

    return result;
  }

  async function loadData() {
    const [tableData, menuData, categoryData] = await Promise.all([
      fetchJSON("/api/tables"),
      fetchJSON("/api/menu"),
      fetchJSON("/api/categories")
    ]);

    setTables(tableData);
    setMenu(menuData);
    setCategories(categoryData);
  }

  useEffect(() => {
    loadData()
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function clearNotification() {
    setError("");
    setMessage("");
  }

  // ===== QUẢN LÝ BÀN =====

  function resetForm() {
    setForm({ ...emptyTableForm });
    setEditingId(null);
  }

  function editTable(table) {
    setEditingId(table.id);

    setForm({
      table_number: table.table_number,
      capacity: table.capacity,
      status: table.status
    });

    clearNotification();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveTable(event) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    clearNotification();

    try {
      await fetchJSON(
        editingId ? `/api/tables/${editingId}` : "/api/tables",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table_number: Number(form.table_number),
            capacity: Number(form.capacity),
            status: form.status
          })
        }
      );

      await loadData();
      setMessage(editingId ? "Đã sửa bàn" : "Đã thêm bàn");
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTable(table) {
    if (!window.confirm(`Xóa Bàn ${table.table_number}?`)) return;

    clearNotification();

    try {
      await fetchJSON(`/api/tables/${table.id}`, {
        method: "DELETE"
      });

      await loadData();

      if (editingId === table.id) resetForm();
      setMessage("Đã xóa bàn");
    } catch (err) {
      setError(err.message);
    }
  }

  // ===== QUẢN LÝ MÓN =====

  function resetMenuForm() {
    setMenuForm({ ...emptyMenuForm });
    setEditingMenuId(null);
  }

  function editMenuItem(item) {
    setEditingMenuId(item.id);

    setMenuForm({
      name: item.name,
      price: item.price,
      category_id: item.category_id ?? "",
      is_available: item.is_available
    });

    clearNotification();

    document.getElementById("menu-management")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveMenuItem(event) {
    event.preventDefault();
    if (menuSaving) return;

    setMenuSaving(true);
    clearNotification();

    try {
      await fetchJSON(
        editingMenuId ? `/api/menu/${editingMenuId}` : "/api/menu",
        {
          method: editingMenuId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: menuForm.name.trim(),
            price: Number(menuForm.price),
            category_id: Number(menuForm.category_id),
            is_available: menuForm.is_available
          })
        }
      );

      await loadData();
      setMessage(editingMenuId ? "Đã sửa món" : "Đã thêm món");
      resetMenuForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setMenuSaving(false);
    }
  }

  async function deleteMenuItem(item) {
    if (!window.confirm(`Xóa món "${item.name}"?`)) return;

    clearNotification();

    try {
      await fetchJSON(`/api/menu/${item.id}`, {
        method: "DELETE"
      });

      await loadData();

      if (editingMenuId === item.id) resetMenuForm();
      setMessage("Đã xóa món");
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleMenuItem(item) {
    clearNotification();

    try {
      await fetchJSON(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          price: Number(item.price),
          category_id: Number(item.category_id),
          is_available: !item.is_available
        })
      });

      await loadData();

      if (editingMenuId === item.id) {
        setMenuForm(previous => ({
          ...previous,
          is_available: !item.is_available
        }));
      }

      setMessage("Đã cập nhật trạng thái món");
    } catch (err) {
      setError(err.message);
    }
  }

  const availableTables = tables.filter(
    table => table.status === "available"
  ).length;

  const availableMenu = menu.filter(
    item => item.is_available
  ).length;

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
          <h2>{availableTables}</h2>
          <p>Bàn còn trống</p>
        </article>
        <article>
          <h2>{menu.length}</h2>
          <p>Tổng số món</p>
        </article>
        <article>
          <h2>{availableMenu}</h2>
          <p>Món đang bán</p>
        </article>
      </section>

      {loading && <p>Đang tải dữ liệu...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {/* FORM QUẢN LÝ BÀN */}
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
              <button
                type="button"
                className="edit-button"
                onClick={() => editTable(table)}
              >
                Sửa
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={() => deleteTable(table)}
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
      </section>

      {/* FORM QUẢN LÝ MÓN */}
      <section className="management-form" id="menu-management">
        <h2>{editingMenuId ? "Chỉnh sửa món ăn" : "Thêm món ăn"}</h2>

        <form onSubmit={saveMenuItem}>
          <label>
            Tên món
            <input
              required
              maxLength="150"
              placeholder="Ví dụ: Cá kho tộ"
              value={menuForm.name}
              onChange={e => setMenuForm({
                ...menuForm,
                name: e.target.value
              })}
            />
          </label>

          <label>
            Giá bán (VNĐ)
            <input
              type="number"
              min="0"
              step="any"
              required
              value={menuForm.price}
              onChange={e => setMenuForm({
                ...menuForm,
                price: e.target.value
              })}
            />
          </label>

          <label>
            Danh mục
            <select
              required
              value={menuForm.category_id}
              onChange={e => setMenuForm({
                ...menuForm,
                category_id: e.target.value
              })}
            >
              <option value="">Chọn danh mục</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Trạng thái
            <select
              value={String(menuForm.is_available)}
              onChange={e => setMenuForm({
                ...menuForm,
                is_available: e.target.value === "true"
              })}
            >
              <option value="true">Còn bán</option>
              <option value="false">Ngừng bán</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="submit" disabled={menuSaving}>
              {menuSaving ? "Đang lưu..." :
                editingMenuId ? "Lưu thay đổi" : "Thêm món"}
            </button>

            {editingMenuId && (
              <button
                type="button"
                className="secondary"
                onClick={resetMenuForm}
              >
                Hủy
              </button>
            )}
          </div>
        </form>
      </section>

      <h2>Thực đơn nhà hàng</h2>
      <section className="menu">
        {menu.map(item => (
          <article key={item.id}>
            <h3>{item.name}</h3>
            <p>{item.category_name}</p>
            <strong>{money(item.price)}</strong>

            <p className={
              item.is_available ? "status-available" : "status-occupied"
            }>
              {item.is_available ? "Còn bán" : "Ngừng bán"}
            </p>

            <div className="table-actions">
              <button
                className="edit-button"
                onClick={() => editMenuItem(item)}
              >
                Sửa
              </button>
              <button
                className="secondary"
                onClick={() => toggleMenuItem(item)}
              >
                {item.is_available ? "Ngừng bán" : "Mở bán"}
              </button>
              <button
                className="delete-button"
                onClick={() => deleteMenuItem(item)}
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
      </section>

      {/* CHỨC NĂNG TẠO ORDER */}
      <OrderManagement onOrderCreated={loadData} />
    </div>
  );
}

export default App;


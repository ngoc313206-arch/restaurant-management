
import { useEffect, useState } from "react";
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

function App() {
  // =========================
  // QUẢN LÝ DỮ LIỆU
  // =========================

  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Quản lý bàn
  const [form, setForm] = useState({ ...emptyTableForm });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Quản lý thực đơn
  const [menuForm, setMenuForm] = useState({ ...emptyMenuForm });
  const [editingMenuId, setEditingMenuId] = useState(null);
  const [menuSaving, setMenuSaving] = useState(false);

  // =========================
  // TẢI DỮ LIỆU TỪ BACKEND
  // =========================

  async function fetchJSON(url, options) {
    const response = await fetch(url, options);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || `Yêu cầu thất bại (${response.status})`
      );
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
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function clearNotification() {
    setError("");
    setMessage("");
  }

  // =========================
  // QUẢN LÝ BÀN ĂN
  // =========================

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

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function saveTable(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    clearNotification();

    try {
      const url = editingId
        ? `/api/tables/${editingId}`
        : "/api/tables";

      await fetchJSON(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          table_number: Number(form.table_number),
          capacity: Number(form.capacity),
          status: form.status
        })
      });

      await loadData();

      setMessage(
        editingId
          ? "Cập nhật bàn thành công!"
          : "Thêm bàn thành công!"
      );

      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTable(table) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa Bàn ${table.table_number}?`
    );

    if (!confirmed) return;

    clearNotification();

    try {
      await fetchJSON(`/api/tables/${table.id}`, {
        method: "DELETE"
      });

      await loadData();

      if (editingId === table.id) {
        resetForm();
      }

      setMessage(`Đã xóa Bàn ${table.table_number}`);
    } catch (err) {
      setError(err.message);
    }
  }

  // =========================
  // QUẢN LÝ THỰC ĐƠN
  // =========================

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

    document
      .getElementById("menu-management")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  }

  async function saveMenuItem(event) {
    event.preventDefault();

    if (menuSaving) return;

    setMenuSaving(true);
    clearNotification();

    try {
      const url = editingMenuId
        ? `/api/menu/${editingMenuId}`
        : "/api/menu";

      await fetchJSON(url, {
        method: editingMenuId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: menuForm.name.trim(),
          price: Number(menuForm.price),
          category_id: Number(menuForm.category_id),
          is_available: menuForm.is_available
        })
      });

      await loadData();

      setMessage(
        editingMenuId
          ? "Cập nhật món ăn thành công!"
          : "Thêm món ăn thành công!"
      );

      resetMenuForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setMenuSaving(false);
    }
  }

  async function deleteMenuItem(item) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa món "${item.name}"?`
    );

    if (!confirmed) return;

    clearNotification();

    try {
      await fetchJSON(`/api/menu/${item.id}`, {
        method: "DELETE"
      });

      await loadData();

      if (editingMenuId === item.id) {
        resetMenuForm();
      }

      setMessage(`Đã xóa món "${item.name}"`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleMenuItem(item) {
    clearNotification();

    try {
      await fetchJSON(`/api/menu/${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: item.name,
          price: Number(item.price),
          category_id: Number(item.category_id),
          is_available: !item.is_available
        })
      });

      await loadData();

      setMessage(
        item.is_available
          ? `Đã ngừng bán "${item.name}"`
          : `Đã mở bán "${item.name}"`
      );

      // Nếu đang sửa chính món vừa bật/tắt,
      // đồng bộ trạng thái trên form.
      if (editingMenuId === item.id) {
        setMenuForm((previous) => ({
          ...previous,
          is_available: !item.is_available
        }));
      }
    } catch (err) {
      setError(err.message);
    }
  }

  // =========================
  // THỐNG KÊ DASHBOARD
  // =========================

  const availableTables = tables.filter(
    (table) => table.status === "available"
  ).length;

  const availableMenu = menu.filter(
    (item) => item.is_available
  ).length;

  const formatPrice = (price) =>
    Number(price).toLocaleString("vi-VN") + " đ";

  // =========================
  // GIAO DIỆN REACT
  // =========================

  return (
    <div className="dashboard">

      {/* HEADER */}
      <header>
        <h1>Hệ thống Quản lý Nhà hàng</h1>
        <p>Restaurant Management / Order System</p>
      </header>

      {/* THỐNG KÊ */}
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
          <p>Tổng số món ăn</p>
        </article>

        <article>
          <h2>{availableMenu}</h2>
          <p>Món đang bán</p>
        </article>
      </section>

      {/* THÔNG BÁO */}
      {loading && <p>Đang tải dữ liệu...</p>}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}

      {/* FORM QUẢN LÝ BÀN */}
      <section className="management-form">
        <h2>
          {editingId ? "Chỉnh sửa bàn ăn" : "Thêm bàn ăn"}
        </h2>

        <form onSubmit={saveTable}>
          <label>
            Số bàn
            <input
              type="number"
              min="1"
              step="1"
              required
              value={form.table_number}
              onChange={(e) =>
                setForm({
                  ...form,
                  table_number: e.target.value
                })
              }
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
              onChange={(e) =>
                setForm({
                  ...form,
                  capacity: e.target.value
                })
              }
            />
          </label>

          <label>
            Trạng thái
            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value
                })
              }
            >
              <option value="available">Còn trống</option>
              <option value="occupied">Đang sử dụng</option>
              <option value="reserved">Đã đặt trước</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? "Đang lưu..."
                : editingId
                  ? "Lưu thay đổi"
                  : "Thêm bàn"}
            </button>

            {editingId && (
              <button
                type="button"
                className="secondary"
                onClick={resetForm}
              >
                Hủy
              </button>
            )}
          </div>
        </form>
      </section>

      {/* DANH SÁCH BÀN */}
      <h2>Danh sách bàn ăn</h2>

      <section className="tables">
        {tables.map((table) => (
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

      {/* FORM QUẢN LÝ MÓN ĂN */}
      <section className="management-form" id="menu-management">
        <h2>
          {editingMenuId
            ? "Chỉnh sửa món ăn"
            : "Thêm món ăn"}
        </h2>

        <form onSubmit={saveMenuItem}>
          <label>
            Tên món
            <input
              type="text"
              required
              maxLength="150"
              placeholder="Ví dụ: Cá kho tộ"
              value={menuForm.name}
              onChange={(e) =>
                setMenuForm({
                  ...menuForm,
                  name: e.target.value
                })
              }
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
              onChange={(e) =>
                setMenuForm({
                  ...menuForm,
                  price: e.target.value
                })
              }
            />
          </label>

          <label>
            Danh mục
            <select
              required
              value={menuForm.category_id}
              onChange={(e) =>
                setMenuForm({
                  ...menuForm,
                  category_id: e.target.value
                })
              }
            >
              <option value="">Chọn danh mục</option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Trạng thái món
            <select
              value={String(menuForm.is_available)}
              onChange={(e) =>
                setMenuForm({
                  ...menuForm,
                  is_available: e.target.value === "true"
                })
              }
            >
              <option value="true">Còn bán</option>
              <option value="false">Ngừng bán</option>
            </select>
          </label>

          <div className="form-actions">
            <button type="submit" disabled={menuSaving}>
              {menuSaving
                ? "Đang lưu..."
                : editingMenuId
                  ? "Lưu thay đổi"
                  : "Thêm món"}
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

      {/* DANH SÁCH THỰC ĐƠN */}
      <h2>Thực đơn nhà hàng</h2>

      <section className="menu">
        {menu.map((item) => (
          <article key={item.id}>
            <h3>{item.name}</h3>

            <p>{item.category_name}</p>

            <strong>{formatPrice(item.price)}</strong>

            <p
              className={
                item.is_available
                  ? "status-available"
                  : "status-occupied"
              }
            >
              {item.is_available ? "Còn bán" : "Ngừng bán"}
            </p>

            <div className="table-actions">
              <button
                type="button"
                className="edit-button"
                onClick={() => editMenuItem(item)}
              >
                Sửa
              </button>

              <button
                type="button"
                className="secondary"
                onClick={() => toggleMenuItem(item)}
              >
                {item.is_available ? "Ngừng bán" : "Mở bán"}
              </button>

              <button
                type="button"
                className="delete-button"
                onClick={() => deleteMenuItem(item)}
              >
                Xóa
              </button>
            </div>
          </article>
        ))}
      </section>

    </div>
  );
}

export default App;


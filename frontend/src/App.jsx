import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/tables").then((res) => {
        if (!res.ok) throw new Error("Không tải được danh sách bàn");
        return res.json();
      }),
      fetch("/api/menu").then((res) => {
        if (!res.ok) throw new Error("Không tải được thực đơn");
        return res.json();
      })
    ])
      .then(([tableData, menuData]) => {
        setTables(tableData);
        setMenu(menuData);
      })
      .catch((err) => setError(err.message));
  }, []);

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

      {error && <p className="error">{error}</p>}

      <h2>Danh sách bàn ăn</h2>
      <section className="tables">
        {tables.map((table) => (
          <article key={table.id}>
            <h3>Bàn {table.table_number}</h3>
            <p>Sức chứa: {table.capacity} người</p>
            <span>
              {table.status === "available" ? "Còn trống" : table.status}
            </span>
          </article>
        ))}
      </section>

      <h2>Thực đơn nhà hàng</h2>
      <section className="menu">
        {menu.map((item) => (
          <article key={item.id}>
            <h3>{item.name}</h3>
            <p>{item.category_name}</p>
            <strong>
              {Number(item.price).toLocaleString("vi-VN")} đ
            </strong>
          </article>
        ))}
      </section>
    </div>
  );
}

export default App;

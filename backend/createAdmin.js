
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (
    !username ||
    !/^[a-z0-9_]{3,50}$/.test(username) ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new Error("Tên đăng nhập hoặc mật khẩu Admin không hợp lệ");
  }

  const pool = new Pool({
    host: process.env.DB_HOST || "db",
    user: process.env.DB_USER || "restaurant_user",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "restaurant_db"
  });

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE username=$1",
      [username]
    );

    if (existing.rows.length) {
      throw new Error("Tài khoản Admin này đã tồn tại");
    }

    const hash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users
       (full_name, username, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      ["Quản trị hệ thống", username, hash]
    );

    console.log("Đã tạo tài khoản Admin thành công");
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});


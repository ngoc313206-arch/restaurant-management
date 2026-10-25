
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { rateLimit } = require("express-rate-limit");

const roles = [
  "admin",
  "manager",
  "waiter",
  "chef",
  "cashier"
];

function setupAuth(app, pool) {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET chưa được cấu hình an toàn");
  }

  const router = express.Router();

  app.use(cookieParser());

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000
  };

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau."
    }
  });

  function clearSession(res) {
    res.clearCookie("restaurant_session", {
      httpOnly: true,
      secure: cookieOptions.secure,
      sameSite: "strict",
      path: "/"
    });
  }

  async function requireAuth(req, res, next) {
    const token = req.cookies?.restaurant_session;

    if (!token) {
      return res.status(401).json({
        error: "Vui lòng đăng nhập"
      });
    }

    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: "restaurant-management",
        audience: "restaurant-web"
      });

      const result = await pool.query(
        `SELECT id, username, full_name, role, is_active, token_version
         FROM users WHERE id=$1`,
        [payload.sub]
      );

      if (!result.rows.length) {
        return res.status(401).json({
          error: "Tài khoản không còn tồn tại"
        });
      }

      const user = result.rows[0];

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          error: "Vai trò không hợp lệ"
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          error: "Tài khoản đã bị khóa"
        });
      }

      if ((payload.version ?? 0) !== user.token_version) {
        return res.status(401).json({
          error: "Phiên đăng nhập đã bị thu hồi"
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        error: "Phiên đăng nhập hết hạn hoặc không hợp lệ"
      });
    }
  }

  function allowRoles(...allowed) {
    return (req, res, next) => {
      if (!req.user || !allowed.includes(req.user.role)) {
        return res.status(403).json({
          error: "Bạn không có quyền thực hiện thao tác này"
        });
      }

      next();
    };
  }

  // Chặn yêu cầu thay đổi dữ liệu từ nguồn không tin cậy.
  // Cấu hình này dành cho frontend localhost:5173.
  function checkOrigin(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const allowedOrigin =
      process.env.APP_ORIGIN || "http://localhost:5173";

    const origin = req.get("origin");

    if (origin !== allowedOrigin) {
      return res.status(403).json({
        error: "Nguồn yêu cầu không được phép"
      });
    }

    next();
  }

  app.use("/api", checkOrigin);

  // ĐĂNG NHẬP
  router.post("/login", authLimiter, async (req, res) => {
    const username = typeof req.body?.username === "string"
      ? req.body.username.trim().toLowerCase()
      : "";

    const password = req.body?.password;

    if (
      !username ||
      typeof password !== "string" ||
      password.length > 200
    ) {
      return res.status(400).json({
        error: "Thông tin đăng nhập không hợp lệ"
      });
    }

    try {
      const result = await pool.query(
        `SELECT id, username, full_name, role, password_hash, is_active, token_version
         FROM users WHERE username=$1`,
        [username]
      );

      const user = result.rows[0];

      if (!user ||
          !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({
          error: "Sai tên đăng nhập hoặc mật khẩu"
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          error: "Tài khoản này đã bị khóa"
        });
      }

      const token = jwt.sign(
        { version: user.token_version },
        secret,
        {
          algorithm: "HS256",
          subject: String(user.id),
          issuer: "restaurant-management",
          audience: "restaurant-web",
          expiresIn: "8h"
        }
      );

      res.cookie("restaurant_session", token, cookieOptions);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Đăng nhập thất bại"
      });
    }
  });

  // XEM PHIÊN HIỆN TẠI
  router.get("/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  // ĐĂNG XUẤT
  router.post("/logout", (req, res) => {
    clearSession(res);
    res.json({ message: "Đã đăng xuất" });
  });

  // ADMIN XEM NHÂN VIÊN
  router.get(
    "/users",
    requireAuth,
    allowRoles("admin"),
    async (req, res) => {
      try {
        const result = await pool.query(
          `SELECT id, full_name, username, role, is_active, created_at
           FROM users ORDER BY id`
        );

        res.json(result.rows);
      } catch (error) {
        console.error(error);
        res.status(500).json({
          error: "Không thể tải danh sách nhân viên"
        });
      }
    }
  );

  // ADMIN TẠO TÀI KHOẢN
  router.post(
    "/users",
    requireAuth,
    allowRoles("admin"),
    async (req, res) => {
      const name = typeof req.body?.full_name === "string"
        ? req.body.full_name.trim()
        : "";

      const username = typeof req.body?.username === "string"
        ? req.body.username.trim().toLowerCase()
        : "";

      const password = req.body?.password;
      const role = req.body?.role;

      if (
        !name || name.length > 100 ||
        !/^[a-z0-9_]{3,50}$/.test(username) ||
        !["manager", "waiter", "chef", "cashier"].includes(role) ||
        typeof password !== "string" ||
        password.length < 12 ||
        Buffer.byteLength(password, "utf8") > 72
      ) {
        return res.status(400).json({
          error: "Thông tin nhân viên không hợp lệ. Mật khẩu cần từ 12 ký tự."
        });
      }

      try {
        const hash = await bcrypt.hash(password, 12);

        const result = await pool.query(
          `INSERT INTO users
           (full_name, username, password_hash, role)
           VALUES ($1, $2, $3, $4)
           RETURNING id, full_name, username, role`,
          [name, username, hash, role]
        );

        res.status(201).json(result.rows[0]);
      } catch (error) {
        if (error.code === "23505") {
          return res.status(409).json({
            error: "Tên đăng nhập đã tồn tại"
          });
        }

        console.error(error);
        res.status(500).json({
          error: "Không thể tạo tài khoản"
        });
      }
    }
  );


  // NHÂN VIÊN TỰ ĐỔI MẬT KHẨU
  router.post(
    "/change-password",
    authLimiter,
    requireAuth,
    async (req, res) => {
      const oldPassword = req.body?.old_password;
      const newPassword = req.body?.new_password;

      if (
        typeof oldPassword !== "string" ||
        typeof newPassword !== "string" ||
        newPassword.length < 12 ||
        newPassword.length > 72 ||
        Buffer.byteLength(newPassword, "utf8") > 72 ||
        oldPassword === newPassword
      ) {
        return res.status(400).json({
          error: "Mật khẩu mới cần từ 12 ký tự, tối đa 72 byte và phải khác mật khẩu cũ"
        });
      }

      try {
        const result = await pool.query(
          "SELECT password_hash FROM users WHERE id=$1",
          [req.user.id]
        );

        const current = result.rows[0];

        if (!current || !await bcrypt.compare(
          oldPassword,
          current.password_hash
        )) {
          return res.status(400).json({
            error: "Mật khẩu hiện tại không đúng"
          });
        }

        const hash = await bcrypt.hash(newPassword, 12);

        const updated = await pool.query(
          `UPDATE users
           SET password_hash=$1, token_version=token_version+1
           WHERE id=$2 AND password_hash=$3
           RETURNING id`,
          [hash, req.user.id, current.password_hash]
        );

        if (!updated.rows.length) {
          return res.status(409).json({
            error: "Mật khẩu vừa được thay đổi. Vui lòng thử lại."
          });
        }

        clearSession(res);

        return res.json({
          message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."
        });
      } catch (error) {
        console.error(error);

        return res.status(500).json({
          error: "Không thể đổi mật khẩu"
        });
      }
    }
  );


  // ADMIN KHÓA HOẶC MỞ KHÓA TÀI KHOẢN
  router.patch(
    "/users/:id/active",
    requireAuth,
    allowRoles("admin"),
    async (req, res) => {
      const id = Number(req.params.id);
      const isActive = req.body?.is_active;

      if (
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        typeof isActive !== "boolean"
      ) {
        return res.status(400).json({
          error: "Thông tin tài khoản không hợp lệ"
        });
      }

      try {
        const result = await pool.query(
          `UPDATE users
           SET is_active=$1,
               token_version=token_version+1
           WHERE id=$2
             AND role IN ('manager', 'waiter', 'chef', 'cashier')
           RETURNING id, username, full_name, role,
                     is_active, token_version`,
          [isActive, id]
        );

        if (!result.rows.length) {
          return res.status(404).json({
            error: "Không tìm thấy nhân viên có thể thay đổi trạng thái"
          });
        }

        res.json({
          message: isActive
            ? "Đã mở khóa tài khoản"
            : "Đã khóa tài khoản và thu hồi phiên đăng nhập",
          user: result.rows[0]
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({
          error: "Không thể cập nhật tài khoản"
        });
      }
    }
  );

  app.use("/api/auth", router);

  // PHÂN QUYỀN CHO TẤT CẢ API NGHIỆP VỤ
  app.use("/api", requireAuth, (req, res, next) => {
    const role = req.user.role;

    if (role === "admin" || role === "manager") {
      return next();
    }

    const method = req.method;
    const path = req.path;

    let allowed = false;

    if (method === "GET") {
      if (role === "waiter") {
        allowed = [
          "/tables", "/menu", "/categories", "/orders"
        ].includes(path);
      }

      if (role === "chef") {
        allowed = path === "/orders";
      }

      if (role === "cashier") {
        allowed = ["/orders", "/payments"].includes(path);
      }
    }

    if (role === "waiter" &&
        method === "POST" &&
        path === "/orders") {
      allowed = true;
    }

    if (role === "chef" &&
        method === "PATCH" &&
        /^\/orders\/[0-9]+\/status$/.test(path)) {
      allowed = true;
    }

    if (role === "cashier" &&
        method === "POST" &&
        path === "/payments") {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({
        error: "Vai trò hiện tại không có quyền truy cập API này"
      });
    }

    next();
  });
}

module.exports = setupAuth;


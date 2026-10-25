
from pathlib import Path

path = Path("backend/auth.js")
source = path.read_text()

if '"/users/:id/active"' in source:
    raise SystemExit("Tính năng khóa tài khoản đã được tích hợp.")

changes = [
    (
        "SELECT id, username, full_name, role\n         FROM users WHERE id=$1",
        "SELECT id, username, full_name, role, is_active, token_version\n         FROM users WHERE id=$1"
    ),
    (
        "SELECT id, username, full_name, role, password_hash\n         FROM users WHERE username=$1",
        "SELECT id, username, full_name, role, password_hash, is_active, token_version\n         FROM users WHERE username=$1"
    ),
    (
        "const token = jwt.sign(\n        {},",
        "const token = jwt.sign(\n        { version: user.token_version },"
    ),
    (
        "SET password_hash=$1\n           WHERE id=$2 AND password_hash=$3",
        "SET password_hash=$1, token_version=token_version+1\n           WHERE id=$2 AND password_hash=$3"
    )
]

for old, new in changes:
    if source.count(old) != 1:
        raise SystemExit(
            "Không tìm thấy đúng cấu trúc:\n"
            + old
            + "\nChưa sửa file. Hãy kiểm tra auth.js."
        )
    source = source.replace(old, new, 1)

# Kiểm tra tài khoản và phiên ngay khi truy cập API
anchor = """      req.user = user;
      next();"""

replacement = """      if (!user.is_active) {
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
      next();"""

if source.count(anchor) != 1:
    raise SystemExit("Không tìm thấy vị trí kiểm tra phiên. Chưa sửa file.")

source = source.replace(anchor, replacement, 1)

# Không cho tài khoản bị khóa đăng nhập
anchor = """      const token = jwt.sign("""

replacement = """      if (!user.is_active) {
        return res.status(403).json({
          error: "Tài khoản này đã bị khóa"
        });
      }

      const token = jwt.sign("""

if source.count(anchor) != 1:
    raise SystemExit("Không tìm thấy vị trí tạo JWT. Chưa sửa file.")

source = source.replace(anchor, replacement, 1)

# API Admin khóa/mở khóa nhân viên
route = '''
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

'''

anchor = '  app.use("/api/auth", router);'

if source.count(anchor) != 1:
    raise SystemExit("Không tìm thấy vị trí đăng ký auth router.")

source = source.replace(anchor, route + anchor, 1)

# Cập nhật API liệt kê nhân viên để frontend biết trạng thái
anchor = "SELECT id, full_name, username, role, created_at"

if source.count(anchor) != 1:
    raise SystemExit("Không tìm thấy API danh sách nhân viên.")

source = source.replace(
    anchor,
    "SELECT id, full_name, username, role, is_active, created_at",
    1
)

# Chỉ ghi file sau khi toàn bộ kiểm tra đều thành công
path.write_text(source)
print("Đã nâng cấp xác thực, khóa tài khoản và thu hồi phiên.")


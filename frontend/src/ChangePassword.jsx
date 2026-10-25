
import { useState } from "react";
import "./ChangePassword.css";

export default function ChangePassword({ onChanged }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    setError("");

    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu mới không khớp");
      return;
    }

    if (newPassword.length < 12) {
      setError("Mật khẩu mới phải có ít nhất 12 ký tự");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Đổi mật khẩu thất bại");
      }

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");

      window.alert(result.message);

      if (onChanged) {
        onChanged();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="change-password-section">
      <h2>Đổi mật khẩu tài khoản</h2>

      <p>
        Để bảo vệ tài khoản, hãy sử dụng mật khẩu riêng,
        khó đoán và không dùng lại mật khẩu cũ.
      </p>

      {error && (
        <p className="change-password-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <label>
          Mật khẩu hiện tại
          <input
            type="password"
            autoComplete="current-password"
            required
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
          />
        </label>

        <label>
          Mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            minLength="12"
            required
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
        </label>

        <label>
          Xác nhận mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            minLength="12"
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "Đang cập nhật..." : "Đổi mật khẩu"}
        </button>
      </form>
    </section>
  );
}


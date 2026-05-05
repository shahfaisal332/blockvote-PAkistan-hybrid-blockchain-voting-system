import { useEffect, useState } from "react";

export default function Toast({ message, type = "info", onClose }) {
  const [visible, setVisible] = useState(true);
  const icons = { success: "✅", error: "❌", warn: "⚠️", info: "ℹ️" };
  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onClose?.(); }, 3500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className={`toast toast-${type}`}>
      <span className="toast-icon">{icons[type] ?? "ℹ️"}</span>
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={() => { setVisible(false); onClose?.(); }}>✕</button>
    </div>
  );
}
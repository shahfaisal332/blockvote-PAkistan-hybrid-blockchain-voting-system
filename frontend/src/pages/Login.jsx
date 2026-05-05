import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import api from "../utils/api";
import Toast from "../components/Toast";

export default function Login() {
  const navigate = useNavigate();
  const [tab,       setTab]      = useState("voter");
  const [toast,     setToast]    = useState(null);
  const [vName,     setVName]    = useState("");
  const [vCnic,     setVCnic]    = useState("");
  const [vLoading,  setVLoading] = useState(false);
  const [aLoading,  setALoading] = useState(false);

  const notify = (message, type = "info") => setToast({ message, type });

  // ── Voter login ─────────────────────────────────────────
  const handleVoterLogin = async () => {
    const name = vName.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    const cnic = vCnic.replace(/\D/g, "");
    if (!name || name.length < 3) { notify("Please enter your full name", "warn"); return; }
    if (!/^\d{13}$/.test(cnic))   { notify("CNIC must be exactly 13 digits", "warn"); return; }
    setVLoading(true);
    try {
      const { data } = await api.post("/voter/login", { name, cnic });
      sessionStorage.setItem("voterHash", data.voterHash);
      sessionStorage.setItem("voterName", data.voterName);
      sessionStorage.setItem("voterCnic", cnic);
      navigate("/voter");
    } catch (e) {
      notify(e.response?.data?.error || "Login failed. Check your name and CNIC.", "error");
    } finally { setVLoading(false); }
  };

  // ── Admin login via MetaMask ────────────────────────────
  const handleAdminLogin = async () => {
    if (!window.ethereum) {
      notify("MetaMask not found. Please install the MetaMask extension.", "error");
      return;
    }
    setALoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const wallet   = accounts[0];
      const { data } = await api.post("/admin/login", { wallet });
      sessionStorage.setItem("adminToken",  data.token);
      sessionStorage.setItem("adminWallet", data.wallet);
      navigate("/admin");
    } catch (e) {
      notify(
        e.response?.data?.error || "Login failed. Use the owner wallet.",
        "error"
      );
    } finally { setALoading(false); }
  };

  return (
    <div className="page">
      <div className="login-box">

        <div className="login-logo">
          <div className="login-logo-icon">🗳️</div>
          <div className="login-title">BlockVote Pakistan</div>
          <div className="login-subtitle">Secure Blockchain-Based Voting System</div>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === "voter" ? "active" : ""}`}
            onClick={() => setTab("voter")}>Voter Login</button>
          <button className={`tab ${tab === "admin" ? "active" : ""}`}
            onClick={() => setTab("admin")}>Admin Login</button>
        </div>

        {tab === "voter" && (
          <div className="card">
            <div className="form-group">
              <label className="form-label">Full Name (as registered by admin)</label>
              <input className="input" placeholder="e.g. Muhammad Ali"
                value={vName} autoComplete="name"
                onChange={e => setVName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleVoterLogin()} />
            </div>
            <div className="form-group">
              <label className="form-label">CNIC Number (13 digits — no dashes)</label>
              <input className="input" placeholder="e.g. 3410212345678"
                maxLength={13} inputMode="numeric" autoComplete="off"
                value={vCnic}
                onChange={e => setVCnic(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && handleVoterLogin()} />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Spaces and dashes removed automatically
              </div>
            </div>
            <button className="btn btn-primary btn-full"
              onClick={handleVoterLogin} disabled={vLoading}>
              {vLoading ? <span className="spin" /> : "🗳️ Login & Vote"}
            </button>
          </div>
        )}

        {tab === "admin" && (
          <div className="card" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🦊</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Connect MetaMask Wallet
            </div>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              Only the contract owner wallet can access the admin panel.
              Connect your MetaMask wallet to continue.
            </p>
            <button className="btn btn-primary btn-full"
              onClick={handleAdminLogin} disabled={aLoading}>
              {aLoading ? <span className="spin" /> : "🔗 Connect Wallet & Login"}
            </button>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
              MetaMask must be installed and unlocked
            </p>
          </div>
        )}

        <p className="text-muted" style={{ textAlign: "center", fontSize: 11, marginTop: 14 }}>
          Powered by Ethereum Blockchain
        </p>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
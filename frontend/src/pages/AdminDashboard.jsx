import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import Toast from "../components/Toast";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const wallet   = sessionStorage.getItem("adminWallet");
  const token    = sessionStorage.getItem("adminToken");
  if (!token || !wallet) { window.location.href = "/"; return null; }

  const [toast,      setToast]      = useState(null);
  const [activeTab,  setActiveTab]  = useState("overview");
  const [loading,    setLoading]    = useState(true);
  const notify = (msg, type = "info") => setToast({ message: msg, type });

  const [groups,   setGroups]   = useState([]);
  const [voters,   setVoters]   = useState([]);
  const [election, setElection] = useState(null);
  const [contractAddr, setContractAddr] = useState("");

  // Group form
  const [newGName,  setNewGName]  = useState("");
  const [editGroup, setEditGroup] = useState(null);
  const [editGName, setEditGName] = useState("");

  // Candidate form
  const [cGroupId, setCGroupId] = useState("");
  const [cName,    setCName]    = useState("");
  const [cParty,   setCParty]   = useState("");
  const [cSymName, setCSymName] = useState("");
  const [cImage,   setCImage]   = useState(null);
  const [cPreview, setCPreview] = useState(null);
  const fileRef = useRef();

  // Edit candidate
  const [editCand, setEditCand] = useState(null);
  const [eCName,   setECName]   = useState("");
  const [eCParty,  setECParty]  = useState("");
  const [eCSym,    setECSym]    = useState("");
  const [eCImg,    setECImg]    = useState(null);
  const [eCPrev,   setECPrev]   = useState(null);
  const editFileRef = useRef();

  // Voter form
  const [vName,     setVName]     = useState("");
  const [vCnic,     setVCnic]     = useState("");
  const [editVoter, setEditVoter] = useState(null);
  const [eVName,    setEVName]    = useState("");
  const [eVCnic,    setEVCnic]    = useState("");

  // Election form
  const [elTitle, setElTitle] = useState("");
  const [elStart, setElStart] = useState("");
  const [elEnd,   setElEnd]   = useState("");

  // ── History state (NEW) ───────────────────────────────────
  const [history,     setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [openHistId,  setOpenHistId]  = useState(null);

  // ── Load data ─────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [g, v, e] = await Promise.all([
        api.get("/admin/groups"),
        api.get("/admin/voters"),
        api.get("/admin/election"),
      ]);
      setGroups(g.data);
      setVoters(v.data);
      setElection(e.data);
      if (e.data) {
        setElTitle(e.data.title || "");
        setElStart(e.data.start_time?.slice(0, 16) || "");
        setElEnd(e.data.end_time?.slice(0, 16)     || "");
        setContractAddr(e.data.contract_address    || "");
      }
    } catch (e) {
      notify("Failed to load: " + (e.response?.data?.error || e.message), "error");
    } finally { setLoading(false); }
  };

  // ── Load history (NEW) ────────────────────────────────────
  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const { data } = await api.get("/admin/elections/history");
      setHistory(data);
    } catch (e) {
      notify("Failed to load history: " + (e.response?.data?.error || e.message), "error");
    } finally { setHistLoading(false); }
  };

  // ── Delete one election from history (NEW) ────────────────
  const deleteOneHistory = async (id, title) => {
    if (!confirm(`Delete results of "${title}"?\nThis cannot be undone.`)) return;
    try {
      await api.delete(`/admin/elections/${id}`);
      notify(`"${title}" deleted from history`, "warn");
      loadHistory();
    } catch (e) {
      notify(e.response?.data?.error || e.message, "error");
    }
  };

  // ── Delete all history except last (NEW) ──────────────────
  const deleteAllExceptLast = async () => {
    if (!confirm(
      "Delete ALL election history except the most recent one?\nThis cannot be undone."
    )) return;
    try {
      await api.delete("/admin/elections/all-except-last");
      notify("All history cleared except the most recent election", "warn");
      loadHistory();
    } catch (e) {
      notify(e.response?.data?.error || e.message, "error");
    }
  };

  // ── Election ──────────────────────────────────────────────
  const saveElection = async () => {
    if (!elTitle.trim() || !elStart || !elEnd) {
      notify("Fill election title, start time and end time", "warn"); return;
    }
    if (new Date(elEnd) <= new Date(elStart)) {
      notify("End time must be after start time", "warn"); return;
    }
    try {
      await api.post("/admin/election", {
        title: elTitle.trim(),
        start_time: elStart,
        end_time: elEnd,
        contract_address: contractAddr || null,
      });
      notify("Election saved successfully! ✅", "success");
      loadAll();
    } catch (e) {
      notify(e.response?.data?.error || e.message, "error");
    }
  };

  // ── Groups ────────────────────────────────────────────────
  const addGroup = async () => {
    const name = newGName.trim();
    if (!name) { notify("Enter a group name", "warn"); return; }
    try {
      await api.post("/admin/groups", { name });
      setNewGName(""); loadAll();
      notify(`Group "${name}" added!`, "success");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  const saveEditGroup = async () => {
    const name = editGName.trim();
    if (!name) { notify("Group name required", "warn"); return; }
    try {
      await api.put(`/admin/groups/${editGroup.id}`, { name });
      setEditGroup(null); loadAll();
      notify("Group updated", "success");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  const deleteGroup = async (id, name) => {
    if (!confirm(`Delete group "${name}" and all its candidates?`)) return;
    try {
      await api.delete(`/admin/groups/${id}`);
      loadAll(); notify("Group deleted", "warn");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  // ── Candidates ────────────────────────────────────────────
  const addCandidate = async () => {
    if (!cGroupId)        { notify("Select a group",       "warn"); return; }
    if (!cName.trim())    { notify("Enter candidate name", "warn"); return; }
    if (!cSymName.trim()) { notify("Enter symbol name",    "warn"); return; }
    try {
      const form = new FormData();
      form.append("group_id",    cGroupId);
      form.append("name",        cName.trim());
      form.append("party_name",  cParty.trim());
      form.append("symbol_name", cSymName.trim());
      if (cImage) form.append("symbol_image", cImage);
      await api.post("/admin/candidates", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCGroupId(""); setCName(""); setCParty(""); setCSymName("");
      setCImage(null); setCPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      loadAll(); notify("Candidate added!", "success");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  const openEditCand = (c) => {
    setEditCand(c); setECName(c.name); setECParty(c.party_name || "");
    setECSym(c.symbol_name); setECPrev(c.symbol_image_url || null); setECImg(null);
  };

  const saveEditCand = async () => {
    if (!eCName.trim() || !eCSym.trim()) { notify("Fill all fields", "warn"); return; }
    try {
      const form = new FormData();
      form.append("name",        eCName.trim());
      form.append("party_name",  eCParty.trim());
      form.append("symbol_name", eCSym.trim());
      if (eCImg) form.append("symbol_image", eCImg);
      await api.put(`/admin/candidates/${editCand.id}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEditCand(null); loadAll(); notify("Candidate updated", "success");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  const deleteCandidate = async (id, name) => {
    if (!confirm(`Delete candidate "${name}"?`)) return;
    try {
      await api.delete(`/admin/candidates/${id}`);
      loadAll(); notify("Candidate deleted", "warn");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  // ── Voters ────────────────────────────────────────────────
  const addVoter = async () => {
    const name = vName.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    const cnic = vCnic.replace(/\D/g, "");
    if (!name || name.length < 3) { notify("Valid full name required (min 3 chars)", "warn"); return; }
    if (!/^\d{13}$/.test(cnic))   { notify("CNIC must be exactly 13 digits",         "warn"); return; }
    try {
      await api.post("/admin/voters", { name, cnic });
      setVName(""); setVCnic(""); loadAll();
      notify(`Voter "${name}" registered!`, "success");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  const openEditVoter = (v) => { setEditVoter(v); setEVName(v.name); setEVCnic(v.cnic); };

  const saveEditVoter = async () => {
    const name = eVName.replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
    const cnic = eVCnic.replace(/\D/g, "");
    if (!name || name.length < 3) { notify("Valid name required", "warn"); return; }
    if (!/^\d{13}$/.test(cnic))   { notify("CNIC must be 13 digits", "warn"); return; }
    try {
      await api.put(`/admin/voters/${editVoter.id}`, { name, cnic });
      setEditVoter(null); loadAll(); notify("Voter updated", "success");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  const deleteVoter = async (id, name) => {
    if (!confirm(`Permanently delete voter "${name}"?`)) return;
    try {
      await api.delete(`/admin/voters/${id}`);
      loadAll(); notify("Voter deleted", "warn");
    } catch (e) { notify(e.response?.data?.error || e.message, "error"); }
  };

  const logout = () => { sessionStorage.clear(); navigate("/"); };

  // ── Election status ───────────────────────────────────────
  const now = new Date();
  const elStatus = !election ? "none"
    : now < new Date(election.start_time) ? "upcoming"
    : now <= new Date(election.end_time)  ? "active"
    : "ended";

  const statusBadge = {
    none:     <span className="badge badge-red">⚙️ Not Configured</span>,
    upcoming: <span className="badge badge-amber">⏳ Upcoming</span>,
    active:   <span className="badge badge-green">🟢 Live</span>,
    ended:    <span className="badge badge-blue">🏁 Ended</span>,
  }[elStatus];

  const totalCands = groups.reduce((a, g) => a + (g.candidates?.length || 0), 0);

  if (loading) return (
    <div className="page">
      <div style={{ textAlign: "center" }}>
        <div className="spin" style={{ width: 34, height: 34, margin: "0 auto 12px" }} />
        <p className="text-muted">Loading...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-icon">🗳️</div>
          <div>
            <div className="topbar-title">BlockVote Admin</div>
            <div className="topbar-sub">{wallet}</div>
          </div>
        </div>
        <div className="topbar-right">
          {statusBadge}
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="dash">

        {/* Stats */}
        <div className="stats">
          <div className="stat"><div className="stat-val">{groups.length}</div><div className="stat-lbl">Groups</div></div>
          <div className="stat"><div className="stat-val">{totalCands}</div><div className="stat-lbl">Candidates</div></div>
          <div className="stat"><div className="stat-val">{voters.length}</div><div className="stat-lbl">Voters</div></div>
          <div className="stat">
            <div className="stat-val" style={{ fontSize: 14, paddingTop: 5 }}>
              {elStatus === "active" ? "LIVE" : elStatus === "ended" ? "DONE" : elStatus === "upcoming" ? "SOON" : "—"}
            </div>
            <div className="stat-lbl">Election</div>
          </div>
        </div>

        {/* Tabs — added "history" tab */}
        <div className="tabs">
          {["overview", "groups", "voters", "results", "history"].map(t => (
            <button
              key={t}
              className={`tab ${activeTab === t ? "active" : ""}`}
              onClick={() => {
                setActiveTab(t);
                if (t === "history") loadHistory();
              }}
            >
              {t === "overview" ? "Overview"
               : t === "groups"  ? "Groups"
               : t === "voters"  ? "Voters"
               : t === "results" ? "Results"
               : "📋 History"}
            </button>
          ))}
        </div>

        {/* ══ OVERVIEW ══════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <>
            <div style={{
              background: "rgba(20,83,45,.2)", border: "1px solid rgba(22,163,74,.4)",
              borderRadius: "var(--rsm)", padding: "10px 14px", fontSize: 12,
              color: "#86efac", marginBottom: 14, lineHeight: 1.6,
            }}>
              ✅ No ETH or gas fees required for admin actions. Groups, candidates,
              voters and election config all save to the database only.
            </div>

            <div className="card">
              <div className="sec-title">Election Configuration</div>
              <div className="form-group">
                <label className="form-label">Election Title</label>
                <input className="input" placeholder="e.g. General Election 2025"
                  value={elTitle} onChange={e => setElTitle(e.target.value)} />
              </div>
              <div className="row" style={{ marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Start Date & Time</label>
                  <input className="input" type="datetime-local"
                    value={elStart} onChange={e => setElStart(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">End Date & Time</label>
                  <input className="input" type="datetime-local"
                    value={elEnd} onChange={e => setElEnd(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Contract Address
                  <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 6 }}>
                    (optional)
                  </span>
                </label>
                <input className="input mono" placeholder="0x... (leave blank for demo mode)"
                  value={contractAddr} onChange={e => setContractAddr(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={saveElection}>
                💾 Save Election
              </button>
            </div>

            {election && (
              <div className="card">
                <div className="sec-title">Current Election</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13 }}>
                  <div><span className="text-muted">Title: </span><strong>{election.title}</strong></div>
                  <div><span className="text-muted">Start: </span>{new Date(election.start_time).toLocaleString()}</div>
                  <div><span className="text-muted">End: </span>{new Date(election.end_time).toLocaleString()}</div>
                  <div>{statusBadge}</div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="sec-title">Share with Voters</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
                Share this link with all registered voters:
              </p>
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--border2)",
                borderRadius: "var(--rsm)", padding: "10px 14px",
                fontFamily: "var(--mono)", fontSize: 13,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
              }}>
                <span>http://localhost:5173</span>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  navigator.clipboard.writeText("http://localhost:5173");
                  notify("Link copied!", "success");
                }}>📋 Copy</button>
              </div>
            </div>
          </>
        )}

        {/* ══ GROUPS & CANDIDATES ═══════════════════════════════ */}
        {activeTab === "groups" && (
          <>
            <div className="card card-sm">
              <div className="sec-title">Add New Group (MNA / MPA / etc.)</div>
              <div className="row">
                <input className="input" placeholder="e.g. MNA Seat 15"
                  value={newGName} onChange={e => setNewGName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addGroup()} />
                <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={addGroup}>
                  + Add Group
                </button>
              </div>
            </div>

            <div className="card card-sm">
              <div className="sec-title">Add Candidate to Group</div>
              <div className="form-group">
                <label className="form-label">Select Group</label>
                <select className="input" value={cGroupId} onChange={e => setCGroupId(e.target.value)}>
                  <option value="">-- Select Group --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <input className="input" placeholder="Candidate full name"
                  value={cName} onChange={e => setCName(e.target.value)} />
                <input className="input" placeholder="Party name (e.g. PTI, PMLN)"
                  value={cParty} onChange={e => setCParty(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Election Symbol Name (e.g. Bat, Lion, Arrow)</label>
                <input className="input" placeholder="Symbol name"
                  value={cSymName} onChange={e => setCSymName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Election Symbol Image</label>
                <div className="img-up-row">
                  {cPreview
                    ? <img src={cPreview} className="img-prev" alt="preview" />
                    : <div style={{ width: 50, height: 50, borderRadius: 8, background: "var(--bg2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏷️</div>
                  }
                  <label className="img-up-lbl">
                    📷 Choose Image
                    <input type="file" accept="image/*" ref={fileRef}
                      onChange={e => { const f = e.target.files[0]; if (f) { setCImage(f); setCPreview(URL.createObjectURL(f)); } }} />
                  </label>
                  {cPreview && (
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      setCImage(null); setCPreview(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}>✕</button>
                  )}
                </div>
              </div>
              <button className="btn btn-success" onClick={addCandidate}>✚ Add Candidate</button>
            </div>

            {groups.length === 0
              ? <div className="card"><div className="empty">No groups yet. Add one above.</div></div>
              : groups.map(g => (
                <div key={g.id} className="card" style={{ marginBottom: 14 }}>
                  <div className="flex-between" style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{g.candidates?.length || 0} candidates</div>
                    </div>
                    <div className="btn-row">
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditGroup(g); setEditGName(g.name); }}>✏️ Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteGroup(g.id, g.name)}>🗑 Delete</button>
                    </div>
                  </div>
                  <div className="admin-cand-list">
                    {(!g.candidates || g.candidates.length === 0)
                      ? <div className="text-muted" style={{ fontSize: 13, padding: "6px 0" }}>No candidates yet.</div>
                      : g.candidates.map(c => (
                        <div key={c.id} className="admin-cand-item">
                          {c.symbol_image_url
                            ? <img src={c.symbol_image_url} className="admin-cand-img" alt={c.symbol_name} />
                            : <div className="admin-cand-av">{c.name.charAt(0)}</div>
                          }
                          <div className="admin-cand-info">
                            <div className="admin-cand-name">{c.name}</div>
                            {c.party_name && <div className="admin-cand-party">🏛️ {c.party_name}</div>}
                            <div className="admin-cand-sym">🏷️ {c.symbol_name}</div>
                          </div>
                          <div className="btn-row">
                            <button className="btn btn-ghost btn-xs" onClick={() => openEditCand(c)}>✏️</button>
                            <button className="btn btn-danger btn-xs" onClick={() => deleteCandidate(c.id, c.name)}>🗑</button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              ))
            }
          </>
        )}

        {/* ══ VOTERS ════════════════════════════════════════════ */}
        {activeTab === "voters" && (
          <>
            <div className="card card-sm">
              <div className="sec-title">Register New Voter</div>
              <div className="row">
                <input className="input" placeholder="Full Name"
                  value={vName} onChange={e => setVName(e.target.value)} />
                <input className="input" placeholder="CNIC (13 digits)" maxLength={13} inputMode="numeric"
                  value={vCnic} onChange={e => setVCnic(e.target.value.replace(/\D/g, ""))} />
                <button className="btn btn-primary" style={{ flexShrink: 0 }} onClick={addVoter}>+ Register</button>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                Spaces auto-removed from name and CNIC.
              </div>
            </div>
            <div className="card">
              <div className="flex-between" style={{ marginBottom: 12 }}>
                <div className="sec-title" style={{ marginBottom: 0 }}>Registered Voters ({voters.length})</div>
              </div>
              {voters.length === 0
                ? <div className="empty">No voters registered yet.</div>
                : <div className="voter-list">
                  {voters.map(v => (
                    <div key={v.id} className="voter-item">
                      <div>
                        <div className="voter-name">{v.name}</div>
                        <div className="voter-cnic">{v.cnic.slice(0,5)}-{v.cnic.slice(5,12)}-{v.cnic.slice(12)}</div>
                      </div>
                      <div className="btn-row">
                        <button className="btn btn-ghost btn-xs" onClick={() => openEditVoter(v)}>✏️ Edit</button>
                        <button className="btn btn-danger btn-xs" onClick={() => deleteVoter(v.id, v.name)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </>
        )}

        {/* ══ RESULTS ═══════════════════════════════════════════ */}
        {activeTab === "results" && <ResultsPanel elStatus={elStatus} notify={notify} />}

        {/* ══ HISTORY TAB (NEW) ═════════════════════════════════ */}
        {activeTab === "history" && (
          <>
            {histLoading ? (
              <div className="card">
                <div className="empty">
                  <div className="spin" style={{ margin: "0 auto" }} />
                </div>
              </div>
            ) : history.length === 0 ? (
              <div className="card">
                <div className="empty">
                  <div style={{ fontSize: 30, marginBottom: 10 }}>📋</div>
                  No election history yet.
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Past elections appear here automatically after they end.
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Delete controls */}
                {history.length > 1 && (
                  <div className="card card-sm" style={{ marginBottom: 14 }}>
                    <div className="flex-between" style={{ flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {history.length} past elections in history
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          The most recent election cannot be deleted.
                        </div>
                      </div>
                      <button className="btn btn-danger btn-sm" onClick={deleteAllExceptLast}>
                        🗑 Delete All Except Last
                      </button>
                    </div>
                  </div>
                )}

                {/* History list */}
                {history.map((el, idx) => {
                  const isLast = idx === 0; // history is newest-first
                  const isOpen = openHistId === el.id;
                  return (
                    <div key={el.id} className="card" style={{ marginBottom: 13 }}>
                      {/* Header */}
                      <div className="flex-between" style={{ flexWrap: "wrap", gap: 10 }}>
                        <div
                          style={{ flex: 1, cursor: "pointer" }}
                          onClick={() => setOpenHistId(isOpen ? null : el.id)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{el.title}</span>
                            {isLast && (
                              <span style={{
                                fontSize: 10, padding: "2px 7px", borderRadius: 10,
                                background: "rgba(37,99,235,.2)", color: "#93c5fd",
                                border: "1px solid rgba(37,99,235,.3)",
                              }}>
                                Most Recent
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                            📅 {new Date(el.start_time).toLocaleDateString()}
                            {" → "}
                            {new Date(el.end_time).toLocaleDateString()}
                            &nbsp;·&nbsp;
                            🗳️ {el.total_votes || 0} total votes
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Delete button — disabled for most recent */}
                          {!isLast ? (
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => deleteOneHistory(el.id, el.title)}
                            >
                              🗑 Delete
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: "var(--muted)" }}>
                              (protected)
                            </span>
                          )}
                          <span
                            style={{ color: "var(--muted)", fontSize: 18, cursor: "pointer" }}
                            onClick={() => setOpenHistId(isOpen ? null : el.id)}
                          >
                            {isOpen ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>

                      {/* Expandable results */}
                      {isOpen && (
                        <div style={{ marginTop: 14 }}>
                          {(!el.groups || el.groups.length === 0) ? (
                            <p style={{ fontSize: 13, color: "var(--muted)" }}>No vote data available.</p>
                          ) : (
                            el.groups.map(g => {
                              const maxV = g.candidates?.length
                                ? Math.max(...g.candidates.map(c => c.vote_count || 0)) : 0;
                              return (
                                <div key={g.id} style={{ marginBottom: 16 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
                                    {g.name}
                                  </div>
                                  {g.candidates?.map((c, i) => (
                                    <div key={c.id} className="result-row">
                                      <div className="result-hdr">
                                        <span className="result-name">
                                          {i === 0 ? "🏆 " : ""}{c.name}
                                          {c.party_name && (
                                            <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 5 }}>
                                              ({c.party_name})
                                            </span>
                                          )}
                                        </span>
                                        <span className="result-cnt">{c.vote_count || 0} votes</span>
                                      </div>
                                      <div className="result-trk">
                                        <div
                                          className={`result-fill ${i === 0 ? "winner" : ""}`}
                                          style={{ width: `${maxV > 0 ? Math.round(((c.vote_count||0)/maxV)*100) : 0}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

      </div>

      {/* Modals */}
      {editGroup && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditGroup(null)}>
          <div className="modal">
            <div className="modal-ttl">Edit Group</div>
            <div className="form-group">
              <label className="form-label">Group Name</label>
              <input className="input" value={editGName} onChange={e => setEditGName(e.target.value)} />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary btn-full" onClick={saveEditGroup}>Save</button>
              <button className="btn btn-ghost btn-full" onClick={() => setEditGroup(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editCand && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditCand(null)}>
          <div className="modal">
            <div className="modal-ttl">Edit Candidate</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="input" value={eCName} onChange={e => setECName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Party Name</label>
              <input className="input" placeholder="e.g. PTI, PMLN, PPP" value={eCParty} onChange={e => setECParty(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Symbol Name</label>
              <input className="input" value={eCSym} onChange={e => setECSym(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Symbol Image</label>
              <div className="img-up-row">
                {eCPrev
                  ? <img src={eCPrev} className="img-prev" alt="preview" />
                  : <div style={{ width: 50, height: 50, borderRadius: 8, background: "var(--bg2)", border: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "center" }}>🏷️</div>
                }
                <label className="img-up-lbl">
                  📷 Change Image
                  <input type="file" accept="image/*" ref={editFileRef}
                    onChange={e => { const f = e.target.files[0]; if (f) { setECImg(f); setECPrev(URL.createObjectURL(f)); } }} />
                </label>
              </div>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary btn-full" onClick={saveEditCand}>Save</button>
              <button className="btn btn-ghost btn-full" onClick={() => setEditCand(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editVoter && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditVoter(null)}>
          <div className="modal">
            <div className="modal-ttl">Edit Voter</div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" value={eVName} onChange={e => setEVName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">CNIC (13 digits)</label>
              <input className="input" maxLength={13} inputMode="numeric"
                value={eVCnic} onChange={e => setEVCnic(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary btn-full" onClick={saveEditVoter}>Save</button>
              <button className="btn btn-ghost btn-full" onClick={() => setEditVoter(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Results panel ─────────────────────────────────────────
function ResultsPanel({ elStatus, notify }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (elStatus === "active" || elStatus === "ended") fetchResults();
    else setLoading(false);
  }, [elStatus]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/voter/results");
      setResults(data);
    } catch (e) {
      notify?.("Failed to load results: " + e.message, "error");
    } finally { setLoading(false); }
  };

  if (elStatus === "none" || elStatus === "upcoming")
    return <div className="card"><div className="empty">Results appear after election starts.</div></div>;

  if (loading)
    return <div className="card"><div className="empty"><div className="spin" style={{ margin: "0 auto" }} /></div></div>;

  if (!results.length)
    return <div className="card"><div className="empty">No votes cast yet.</div></div>;

  return (
    <>
      {results.map(g => {
        const maxV = g.candidates?.length
          ? Math.max(...g.candidates.map(c => c.vote_count || 0)) : 0;
        return (
          <div key={g.id} className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{g.name}</div>
            {g.candidates?.map((c, i) => (
              <div key={c.id} className="result-row">
                <div className="result-hdr">
                  <span className="result-name">
                    {i === 0 && elStatus === "ended" ? "🏆 " : ""}{c.name}
                    {c.party_name && <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 5 }}>({c.party_name})</span>}
                    <span className="text-muted" style={{ fontSize: 11, marginLeft: 5 }}>🏷️ {c.symbol_name}</span>
                  </span>
                  <span className="result-cnt">{c.vote_count || 0} votes</span>
                </div>
                <div className="result-trk">
                  <div
                    className={`result-fill ${i === 0 && elStatus === "ended" ? "winner" : ""}`}
                    style={{ width: `${maxV > 0 ? Math.round(((c.vote_count||0)/maxV)*100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <button className="btn btn-ghost" onClick={fetchResults} style={{ marginTop: 4 }}>
        🔄 Refresh Results
      </button>
    </>
  );
}
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import Toast from "../components/Toast";

export default function VoterDashboard() {
  const navigate  = useNavigate();
  const voterHash = sessionStorage.getItem("voterHash");
  const voterName = sessionStorage.getItem("voterName");
  const voterCnic = sessionStorage.getItem("voterCnic");

  if (!voterHash || !voterName) { window.location.href = "/"; return null; }

  const [toast,        setToast]        = useState(null);
  const [activeTab,    setActiveTab]    = useState("vote");
  const [election,     setElection]     = useState(null);
  const [groups,       setGroups]       = useState([]);
  const [locked,       setLocked]       = useState({});     // groupId → true
  const [selected,     setSelected]     = useState({});     // groupId → candidateId
  const [submitting,   setSubmitting]   = useState({});     // groupId → true
  const [loading,      setLoading]      = useState(true);
  const [prevResult,   setPrevResult]   = useState(null);   // { election, groups }
  const [prevLoading,  setPrevLoading]  = useState(false);

  const notify = (msg, type = "info") => setToast({ message: msg, type });

  // ── Load current election + groups + already-voted groups ─
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [elRes, grRes] = await Promise.all([
        api.get("/voter/election"),
        api.get("/voter/groups"),
      ]);
      setElection(elRes.data);
      setGroups(grRes.data);

      // Check which groups voter already voted in (active election only)
      if (elRes.data?.electionState === "active" && voterHash) {
        const mv = await api.post("/voter/myvotes", { voterHash });
        const newLocked = {};
        (mv.data.votedGroups || []).forEach(gid => { newLocked[gid] = true; });
        setLocked(newLocked);
      }
    } catch (e) {
      notify("Failed to load: " + (e.response?.data?.error || e.message), "error");
    } finally { setLoading(false); }
  };

  // ── Load previous election result (only one) ──────────────
  const loadPrevResult = async () => {
    setPrevLoading(true);
    try {
      const { data } = await api.get("/voter/previous-result");
      setPrevResult(data); // null if no previous election
    } catch (e) {
      notify("Failed to load results: " + (e.response?.data?.error || e.message), "error");
    } finally { setPrevLoading(false); }
  };

  // Load previous result when switching to results tab
  const handleResultsTab = () => {
    setActiveTab("results");
    if (!prevResult) loadPrevResult();
  };

  // ── Submit vote ───────────────────────────────────────────
  const submitVote = async (groupId) => {
    const candidateId = selected[groupId];
    if (!candidateId) { notify("Please select a candidate first", "warn"); return; }

    setSubmitting(prev => ({ ...prev, [groupId]: true }));
    try {
      await api.post("/voter/vote", {
        voterHash,
        voterCnic,
        groupId,
        candidateId,
      });
      setLocked(prev => ({ ...prev, [groupId]: true }));
      const cand = groups.find(g => g.id === groupId)
        ?.candidates?.find(c => c.id === candidateId);
      notify(`✅ Vote for "${cand?.name}" recorded!`, "success");
    } catch (e) {
      const msg = e.response?.data?.error || e.message;
      if (msg.includes("Already voted")) {
        setLocked(prev => ({ ...prev, [groupId]: true }));
        notify("You already voted in this group", "warn");
      } else {
        notify(msg || "Failed to submit vote", "error");
      }
    } finally {
      setSubmitting(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const logout = () => { sessionStorage.clear(); navigate("/"); };

  const allLocked  = groups.length > 0 && groups.every(g => locked[g.id]);
  const elState    = election?.electionState; // "active" | "upcoming" | "ended" | null

  // ── Loading ───────────────────────────────────────────────
  if (loading) return (
    <div className="page">
      <div style={{ textAlign: "center" }}>
        <div className="spin" style={{ width: 34, height: 34, margin: "0 auto 12px" }} />
        <p className="text-muted">Loading election data...</p>
      </div>
    </div>
  );

  // ── Status badge ──────────────────────────────────────────
  const statusBadge =
    elState === "active"   ? <span className="badge badge-green">🟢 Election Live</span>
    : elState === "upcoming" ? <span className="badge badge-amber">⏳ Upcoming</span>
    : elState === "ended"    ? <span className="badge badge-blue">🏁 Ended</span>
    :                          <span className="badge badge-red">⚙️ Not Configured</span>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-icon">🗳️</div>
          <div>
            <div className="topbar-title">
              {election?.title || "BlockVote Pakistan"}
            </div>
            <div className="topbar-sub">
              {voterName} · {voterCnic?.slice(0, 5)}···
            </div>
          </div>
        </div>
        <div className="topbar-right">
          {statusBadge}
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </div>

      <div className="dash">

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "vote" ? "active" : ""}`}
            onClick={() => setActiveTab("vote")}
          >
            🗳️ Vote
          </button>
          <button
            className={`tab ${activeTab === "results" ? "active" : ""}`}
            onClick={handleResultsTab}
          >
            📊 Previous Results
          </button>
        </div>

        {/* ════════════ VOTE TAB ════════════════════════════ */}
        {activeTab === "vote" && (
          <>
            {/* No election */}
            {!election && (
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⚙️</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  No Election Configured
                </div>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Admin has not set up any election yet. Please check back later.
                </p>
              </div>
            )}

            {/* Upcoming */}
            {elState === "upcoming" && (
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>⏳</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  Election Not Started Yet
                </div>
                <p className="text-muted" style={{ fontSize: 13 }}>
                  Starts at:{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {new Date(election.start_time).toLocaleString()}
                  </strong>
                </p>
                <p className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
                  You can view previous election results in the{" "}
                  <span
                    style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                    onClick={handleResultsTab}
                  >
                    Previous Results tab
                  </span>
                </p>
              </div>
            )}

            {/* Election ended — push voter to results */}
            {elState === "ended" && (
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏁</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  Election Has Ended
                </div>
                <p className="text-muted" style={{ fontSize: 13, marginBottom: 14 }}>
                  <strong style={{ color: "var(--text)" }}>{election.title}</strong> has ended.
                  You can now view the results.
                </p>
                <button className="btn btn-primary" onClick={handleResultsTab}>
                  📊 View Results
                </button>
              </div>
            )}

            {/* Active election — full voting UI */}
            {elState === "active" && (
              <>
                {/* Info */}
                {!allLocked && (
                  <div className="card card-sm" style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                      ℹ️ Vote <strong style={{ color: "var(--text)" }}>once per group</strong>.
                      Select a candidate then click{" "}
                      <strong style={{ color: "var(--text)" }}>Submit Vote</strong>.
                      That group locks permanently.
                    </p>
                  </div>
                )}

                {/* All done */}
                {allLocked && (
                  <div className="card" style={{
                    background: "var(--gBg)",
                    border: "1px solid var(--gBdr)",
                    textAlign: "center",
                    marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#86efac" }}>
                      All votes submitted!
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      You have voted in all groups. Thank you.
                    </p>
                    <button
                      className="btn btn-danger btn-full"
                      style={{ marginTop: 14, maxWidth: 200, margin: "14px auto 0" }}
                      onClick={logout}
                    >
                      Logout
                    </button>
                  </div>
                )}

                {groups.length === 0 && (
                  <div className="card">
                    <div className="empty">No candidates added yet.</div>
                  </div>
                )}

                {/* Group cards */}
                {groups.map(g => {
                  const isLocked = !!locked[g.id];
                  const isSub    = !!submitting[g.id];
                  const selCand  = g.candidates?.find(c => c.id === selected[g.id]);

                  return (
                    <div key={g.id} className={`group-card ${isLocked ? "g-locked" : ""}`}>
                      <div className="group-head">
                        <div>
                          <div className="group-title">{g.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {g.candidates?.length || 0} candidates
                          </div>
                        </div>
                        {isLocked
                          ? <span className="badge badge-green">✅ Voted & Locked</span>
                          : <span className="badge badge-amber">⏳ Pending</span>
                        }
                      </div>

                      <div className="group-body">
                        {isLocked ? (
                          <div style={{
                            textAlign: "center", padding: "10px 0",
                            fontSize: 13, color: "var(--muted)",
                          }}>
                            Your vote for this group is recorded.
                          </div>
                        ) : (
                          <>
                            <div className="cands-grid">
                              {g.candidates?.map(c => {
                                const isSel = selected[g.id] === c.id;
                                return (
                                  <div
                                    key={c.id}
                                    className={`cand-card ${isSel ? "c-selected" : ""}`}
                                    onClick={() =>
                                      !isLocked &&
                                      setSelected(prev => ({ ...prev, [g.id]: c.id }))
                                    }
                                  >
                                    {c.symbol_image_url
                                      ? <img src={c.symbol_image_url} className="cand-img" alt={c.symbol_name} />
                                      : <div className="cand-av">{c.name.charAt(0)}</div>
                                    }
                                    <div className="cand-name">{c.name}</div>
                                    {c.party_name && (
                                      <div className="cand-party">🏛️ {c.party_name}</div>
                                    )}
                                    <div className="cand-sym">🏷️ {c.symbol_name}</div>
                                    {isSel && <div className="cand-tick">✓</div>}
                                  </div>
                                );
                              })}
                            </div>

                            {selected[g.id] && (
                              <div className="group-foot">
                                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                                  Selected:{" "}
                                  <strong style={{ color: "var(--text)" }}>
                                    {selCand?.name}
                                  </strong>
                                  {selCand?.party_name && (
                                    <span style={{ color: "var(--accent)", marginLeft: 5 }}>
                                      ({selCand.party_name})
                                    </span>
                                  )}
                                </span>
                                <button
                                  className="btn btn-success"
                                  onClick={() => submitVote(g.id)}
                                  disabled={isSub}
                                >
                                  {isSub
                                    ? <><span className="spin" /> Submitting...</>
                                    : "✅ Submit Vote"
                                  }
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {/* ════════════ PREVIOUS RESULTS TAB ═══════════════ */}
        {activeTab === "results" && (
          <>
            {prevLoading ? (
              <div className="card">
                <div className="empty">
                  <div className="spin" style={{ margin: "0 auto" }} />
                </div>
              </div>
            ) : !prevResult ? (
              <div className="card">
                <div className="empty">
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                  No previous election results available yet.
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Results appear here after an election ends.
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Election info banner */}
                <div className="card" style={{
                  background: "rgba(37,99,235,.1)",
                  border: "1px solid rgba(37,99,235,.3)",
                  marginBottom: 16,
                }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 22 }}>🏁</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)" }}>
                        {prevResult.election.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {new Date(prevResult.election.start_time).toLocaleString()}
                        {" → "}
                        {new Date(prevResult.election.end_time).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Results per group */}
                {prevResult.groups.map(g => {
                  const maxV = g.candidates?.length
                    ? Math.max(...g.candidates.map(c => c.vote_count || 0))
                    : 0;
                  const winner = g.candidates?.[0];

                  return (
                    <div key={g.id} className="card" style={{ marginBottom: 14 }}>
                      {/* Winner banner */}
                      {winner && maxV > 0 && (
                        <div className="winner-banner" style={{ marginBottom: 14 }}>
                          <span className="winner-crown">🏆</span>
                          <div>
                            <div className="winner-name">{winner.name}</div>
                            <div className="winner-sub">
                              {g.name}
                              {winner.party_name ? ` · 🏛️ ${winner.party_name}` : ""}
                              {` · 🏷️ ${winner.symbol_name} · ${winner.vote_count} votes`}
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
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
                              <span className="text-muted" style={{ fontSize: 11, marginLeft: 5 }}>
                                🏷️ {c.symbol_name}
                              </span>
                            </span>
                            <span className="result-cnt">{c.vote_count || 0} votes</span>
                          </div>
                          <div className="result-trk">
                            <div
                              className={`result-fill ${i === 0 ? "winner" : ""}`}
                              style={{
                                width: `${maxV > 0
                                  ? Math.round(((c.vote_count || 0) / maxV) * 100)
                                  : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
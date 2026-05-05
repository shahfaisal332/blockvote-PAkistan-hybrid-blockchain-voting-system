// ── Basic localStorage helpers ────────────────────────────

export const getData = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
};

export const setData = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const removeData = (key) => {
  localStorage.removeItem(key);
};

// ── Election history helpers ──────────────────────────────

/**
 * Archives the current election + its votes into history.
 * Call this BEFORE starting a new election.
 * Each archived election gets a unique id and stores
 * the vote snapshot so results are preserved forever.
 */
export const archiveCurrentElection = () => {
  const election = getData("election", null);
  const votes    = getData("votes",    {});
  const groups   = getData("groups",   []);

  // Only archive if an election actually happened
  if (!election || !election.started) return;

  const history = getData("electionHistory", []);

  // Build a full snapshot of this election with vote counts
  const snapshot = {
    id:         election.id || Date.now(),
    title:      election.title || `Election ${history.length + 1}`,
    startedAt:  election.startedAt  || null,
    endedAt:    election.endedAt    || new Date().toISOString(),
    totalVotes: Object.keys(votes).length,
    // Store groups with candidate vote counts baked in
    groups: groups.map(g => ({
      id:   g.id,
      name: g.name,
      candidates: g.candidates.map(c => ({
        id:    c.id,
        name:  c.name,
        votes: Object.values(votes).filter(v => v[g.id] === c.id).length,
      })).sort((a, b) => b.votes - a.votes),
    })),
  };

  history.unshift(snapshot); // newest first
  setData("electionHistory", history);
};

/**
 * Returns all past archived elections, newest first.
 */
export const getElectionHistory = () => {
  return getData("electionHistory", []);
};

/**
 * Delete ONE specific election from history by its id.
 * The most recent (last) election in history cannot be deleted
 * unless it is the only one — enforced in the UI, not here.
 */
export const deleteOneFromHistory = (electionId) => {
  const history = getData("electionHistory", []);
  const updated = history.filter(e => e.id !== electionId);
  setData("electionHistory", updated);
  return updated;
};

/**
 * Delete ALL history EXCEPT the most recent (last) election.
 * The last election result must always be kept.
 */
export const deleteAllHistoryExceptLast = () => {
  const history = getData("electionHistory", []);
  if (history.length <= 1) return history; // nothing to delete
  const kept = [history[0]]; // keep only the most recent
  setData("electionHistory", kept);
  return kept;
};
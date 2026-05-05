// ── CNIC helpers ──────────────────────────────────────────

/**
 * Removes all non-digit characters and spaces from CNIC.
 * "34102-1234567-8" → "3410212345678"
 */
export const normalizeCNIC = (cnic) =>
  String(cnic || "").replace(/\D/g, "").replace(/\s/g, "").trim();

/**
 * Returns true if CNIC is exactly 13 digits.
 */
export const isValidCNIC = (cnic) =>
  /^\d{13}$/.test(normalizeCNIC(cnic));

/**
 * Formats a 13-digit CNIC for display: 34102-1234567-8
 */
export const formatCNIC = (cnic) => {
  const c = normalizeCNIC(cnic);
  if (c.length === 13)
    return `${c.slice(0,5)}-${c.slice(5,12)}-${c.slice(12)}`;
  return cnic;
};

// ── Name helpers ──────────────────────────────────────────

/**
 * Removes leading/trailing spaces and collapses internal
 * multiple spaces into one.
 * "  Ali  Khan  " → "Ali Khan"
 */
export const normalizeName = (name) =>
  String(name || "").replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");

/**
 * Returns true if name is at least 3 characters after normalizing.
 */
export const isValidName = (name) =>
  normalizeName(name).length >= 3;
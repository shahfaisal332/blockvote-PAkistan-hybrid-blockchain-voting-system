export const ADMIN_PASSWORD = "admin123"; // change this before your demo

export const isAdminLoggedIn = () =>
  localStorage.getItem("adminAuth") === "true";

export const loginAdmin = (password) => {
  if (password === ADMIN_PASSWORD) {
    localStorage.setItem("adminAuth", "true");
    return true;
  }
  return false;
};

export const logoutAdmin = () => {
  localStorage.removeItem("adminAuth");
  window.location.href = "/";
};
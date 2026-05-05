import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login          from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import VoterDashboard from "./pages/VoterDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<Login />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/voter" element={<VoterDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
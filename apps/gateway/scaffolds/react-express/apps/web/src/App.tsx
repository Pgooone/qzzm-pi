import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: "1rem", background: "#1e40af", color: "#fff", display: "flex", gap: "1rem" }}>
        <Link to="/" style={{ color: "#fff", textDecoration: "none" }}>首页</Link>
        <Link to="/about" style={{ color: "#fff", textDecoration: "none" }}>关于</Link>
      </nav>
      <main style={{ maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

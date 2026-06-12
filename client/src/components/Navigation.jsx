import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FiHome, FiTrendingUp, FiPackage, FiUser, FiMenu, FiX,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard",   path: "/dashboard",   Icon: FiHome },
  { label: "Trends",      path: "/trends",       Icon: FiTrendingUp },
  { label: "Medications", path: "/medications",  Icon: FiPackage },
  { label: "Profile",     path: "/profile",      Icon: FiUser },
];

export function NavHamburger() {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full transition-opacity hover:opacity-80"
        style={{ color: "white", background: "rgba(255,255,255,0.2)" }}
      >
        {open ? <FiX size={18} /> : <FiMenu size={18} />}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-2xl overflow-hidden z-50"
          style={{
            top: "100%",
            background: "white",
            border: "1px solid #DDD5EE",
            boxShadow: "0 8px 24px rgba(92,78,138,0.12)",
          }}
        >
          {NAV_ITEMS.map(({ label, path, Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[#F0EBF8]"
              style={({ isActive }) => ({
                color: isActive ? "#7C6BAE" : "#6B5F7A",
                fontWeight: isActive ? "500" : "400",
              })}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => { setOpen(false); logout(); navigate("/"); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#F0EBF8] transition-colors"
            style={{ color: "#B07088", borderTop: "1px solid #F0EBF8" }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Navigation() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ background: "white", borderTop: "1px solid #DDD5EE" }}
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map(({ label, path, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className="flex flex-col items-center gap-0.5 py-2 transition-colors"
            style={({ isActive }) => ({ color: isActive ? "#7C6BAE" : "#6B5F7A" })}
          >
            <Icon size={20} />
            <span style={{ fontSize: "10px" }}>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default Navigation;

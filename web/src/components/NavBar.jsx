import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import Logo from "../components/Logo";
import "../index.css";

export default function NavBar({ onSelectRole }) {
  const [user, setUser] = useState(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);     // guest menu
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);     // signed-in menu
  const roleMenuRef = useRef(null);
  const acctMenuRef = useRef(null);
  const navigate = useNavigate();

  const roles = [
    { label: "User", value: "user" },
    { label: "Restaurant Manager", value: "restaurant" },
    { label: "Courier", value: "courier" },
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // close on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target)) {
        setRoleMenuOpen(false);
      }
      if (acctMenuRef.current && !acctMenuRef.current.contains(e.target)) {
        setAcctMenuOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") {
        setRoleMenuOpen(false);
        setAcctMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("selectedRole");
      onSelectRole?.(null);
      navigate("/");
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  const handleRoleClick = (value) => {
    onSelectRole?.(value);
    setRoleMenuOpen(false);
    navigate("/login");
  };

  const initials = (() => {
    if (!user) return "";
    const n = user.displayName || user.email || "";
    const parts = n.split("@")[0].split(/[.\s_-]/).filter(Boolean);
    return (parts[0]?.[0] || "U").toUpperCase();
  })();

  return (
    <header className="app-header" role="banner">
      <div className="header-inner">
        {/* Left: Logo (click to home) */}
        <div className="header-left">
          <Link to="/" className="logo-link" aria-label="Go to Home">
            <Logo width={120} />
          </Link>
        </div>

        {/* Center: (optional) page title or address chip could go here */}

        {/* Right: Auth / Account */}
        <div className="header-right">
          {user ? (
            <div className="account" ref={acctMenuRef}>
              <button
                className="account-button"
                aria-haspopup="menu"
                aria-expanded={acctMenuOpen}
                onClick={() => setAcctMenuOpen((v) => !v)}
              >
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span className="account-name">
                  {user.displayName || user.email}
                </span>
                <span className="caret" aria-hidden="true">▾</span>
              </button>

              {acctMenuOpen && (
                <ul className="menu" role="menu">
                  <li role="menuitem">
                    <Link to="/orders" onClick={() => setAcctMenuOpen(false)}>
                      My Orders
                    </Link>
                  </li>
                  <li role="menuitem">
                    <Link to="/restaurant" onClick={() => setAcctMenuOpen(false)}>
                      Restaurant Dashboard
                    </Link>
                  </li>
                  <li className="menu-sep" aria-hidden="true" />
                  <li role="menuitem">
                    <button className="menu-danger" onClick={handleLogout}>
                      Sign out
                    </button>
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <div className="guest" ref={roleMenuRef}>
              <button
                className="primary-btn"
                aria-haspopup="menu"
                aria-expanded={roleMenuOpen}
                onClick={() => setRoleMenuOpen((v) => !v)}
              >
                Login as <span className="caret">▾</span>
              </button>
              {roleMenuOpen && (
                <ul className="menu" role="menu">
                  {roles.map((r) => (
                    <li key={r.value} role="menuitem">
                      <button onClick={() => handleRoleClick(r.value)}>
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/login" className="ghost-btn">Sign up</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
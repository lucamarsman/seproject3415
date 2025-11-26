import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import Logo from "../components/Logo";
import "../index.css";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function NavBar({
  onSelectRole,
  isSidebarOpen,
  onToggleSidebar,
}) {
  const [user, setUser] = useState(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [profileImg, setProfileImg] = useState(null);
  const [selectedRole, setSelectedRole] = useState(() =>
    localStorage.getItem("selectedRole")
  );
  const roleMenuRef = useRef(null);
  const acctMenuRef = useRef(null);
  const navigate = useNavigate();

  const isUserPage = window.location.pathname.startsWith("/user");

  const roles = [
    { label: "User", value: "user" },
    { label: "Restaurant Manager", value: "restaurant" },
    { label: "Courier", value: "courier" },
  ];

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  // Fetch Firestore profileImg
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfileImg(null);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          setProfileImg(data.profileImg || null);
        } else {
          setProfileImg(null);
        }
      } catch (err) {
        console.error("Error loading profile image:", err);
        setProfileImg(null);
      }
    };

    fetchProfile();
  }, [user]);

  const photoURL = profileImg;

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

  useEffect(() => {
    const role = localStorage.getItem("selectedRole");
    if (role) setSelectedRole(role);
  }, [user]);

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
    localStorage.setItem("selectedRole", value);
    setSelectedRole(value);
    onSelectRole?.(value);
    setRoleMenuOpen(false);
    navigate("/login");
  };

  const initials = (() => {
    if (!user) return "";
    const n = user.displayName || user.email || "";
    const parts = n
      .split("@")[0]
      .split(/[.\s_-]/)
      .filter(Boolean);
    return (parts[0]?.[0] || "U").toUpperCase();
  })();

  return (
    <header className="app-header" role="banner">
      <div className="header-inner">
        <div className="header-left flex items-center gap-2">
          {isUserPage && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-300 bg-white shadow-sm cursor-pointer"
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={isSidebarOpen}
            >
              {isSidebarOpen ? "✕" : "☰"}
            </button>
          )}

          <Link to="/" className="logo-link" aria-label="Go to Home">
            <Logo width={120} />
          </Link>
        </div>

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
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt="Profile"
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="avatar" aria-hidden="true">
                    {initials}
                  </span>
                )}
                <span className="account-name">
                  {user.displayName || user.email}
                </span>
                <span className="caret" aria-hidden="true">
                  ▾
                </span>
              </button>

              {acctMenuOpen && (
                <ul className="menu" role="menu">
                  {selectedRole === "user" && (
                    <li role="menuitem">
                      <Link to="/user" onClick={() => setAcctMenuOpen(false)}>
                        User Profile
                      </Link>
                    </li>
                  )}

                  {selectedRole === "restaurant" && (
                    <li role="menuitem">
                      <Link
                        to="/restaurant"
                        onClick={() => setAcctMenuOpen(false)}
                      >
                        Manager Profile
                      </Link>
                    </li>
                  )}

                  {selectedRole === "courier" && (
                    <li role="menuitem">
                      <Link
                        to="/courier"
                        onClick={() => setAcctMenuOpen(false)}
                      >
                        Courier Profile
                      </Link>
                    </li>
                  )}

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
              <Link to="/signup" className="ghost-btn">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

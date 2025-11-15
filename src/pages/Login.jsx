import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";

export default function Login({ role }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (!role) return <Navigate to="/" />;

  const prettyRole =
    role === "restaurant" ? "Restaurant Manager" :
    role === "courier" ? "Courier" : "User";

  const login = async () => {
    setErr(""); setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      navigate(`/${role}`);
    } catch (e) {
      console.error("Login failed", e);
      setErr(e?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      {/* HERO */}
      <section className="auth-hero">
        <h1 className="auth-title">Welcome to Grab N Go</h1>
        <p className="auth-subtitle">
          Sign in with Google to continue as{" "}
          <span className="role-badge">{prettyRole}</span>
        </p>
      </section>

      {/* GRID: Sign-in + Why/Benefits */}
      <div className="auth-grid">
        {/* Card: Google Sign-in */}
        <div className="auth-card">
          <h2 className="card-title">Sign in with Google</h2>
          <p className="card-sub">Quick, secure, and zero password hassle.</p>

          {err && <div className="alert error">{err}</div>}

          <button
            onClick={login}
            className="google-btn"
            disabled={loading}
            aria-busy={loading}
          >
            <span className="google-icon" aria-hidden="true">
              {/* Google G mark */}
              <svg width="18" height="18" viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg">
                <path fill="#EA4335" d="M533.5 278.4c0-18.6-1.5-37-4.7-54.8H272.1v103.8h147.1c-6.2 33.4-25.9 61.7-55.1 80.7v66h88.9c52.1-48 80.5-118.7 80.5-195.7z"/>
                <path fill="#34A853" d="M272.1 544.3c74.1 0 136.3-24.5 181.7-66.2l-88.9-66c-24.7 16.6-56.4 26.5-92.7 26.5-71.3 0-131.7-48.1-153.4-112.6H27.6v70.7c45.2 89.6 137.9 147.6 244.5 147.6z"/>
                <path fill="#4A90E2" d="M118.7 326c-10.4-31-10.4-64.5 0-95.5V159.7H27.6c-37.7 75.2-37.7 165.1 0 240.3l91.1-74z"/>
                <path fill="#FBBC05" d="M272.1 106.1c40.3-.6 79.3 14.7 109.1 43.1l81.5-81.5C413.9 24.9 344.7-1 272.1 0 165.5 0 72.8 58 27.6 147.6l91.1 70.8c21.7-64.5 82.2-112.3 153.4-112.3z"/>
              </svg>
            </span>
            {loading ? "Signing in..." : "Continue with Google"}
          </button>

          <p className="tos">
            By continuing, you agree to our{" "}
            <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
          </p>
        </div>

        {/* Card: Why + Benefits */}
        <div className="auth-card alt">
          <h3 className="card-title">Why Grab N Go?</h3>
          <ul className="benefits">
            <li>Fast Google sign-in, no passwords</li>
            <li>Role-aware dashboards for {prettyRole.toLowerCase()}</li>
            <li>Live order status & updates</li>
            <li>Secure payments (test mode)</li>
          </ul>

          <div className="tip">
            <strong>Tip:</strong> Pick your role in the header first so we route you to the right dashboard after sign-in.
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section className="how-steps">
        <h3>How it works</h3>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-emoji">🔐</div>
            <div className="step-title">1) Sign in</div>
            <div className="step-text">Use your Google account to get started instantly.</div>
          </div>
          <div className="step-card">
            <div className="step-emoji">🍔</div>
            <div className="step-title">2) Pick & order</div>
            <div className="step-text">Browse nearby restaurants and place your order.</div>
          </div>
          <div className="step-card">
            <div className="step-emoji">⏱️</div>
            <div className="step-title">3) Track in real time</div>
            <div className="step-text">See confirmations and status updates as they happen.</div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF / TESTIMONIALS */}
      <section className="testimonials">
        <div className="quote-card">
          <p>
            “Super quick to sign in and place an order. The status updates made the wait painless.”
          </p>
          <span>— Beta tester</span>
        </div>
        <div className="quote-card">
          <p>
            “Clean UI and role-based flows. As a restaurant owner, accepting orders is a breeze.”
          </p>
          <span>— Restaurant owner</span>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq">
        <h3>FAQ</h3>
        <details>
          <summary>Do I need a password?</summary>
          <p>Nope — we use Google sign-in for a quick, secure login.</p>
        </details>
        <details>
          <summary>Which roles can sign in?</summary>
          <p>Users, Restaurant Managers, and Couriers. Pick one in the header first.</p>
        </details>
        <details>
          <summary>Is payment real?</summary>
          <p>Not in MVP — payments are configured in test mode only.</p>
        </details>
      </section>
    </div>
  );
}
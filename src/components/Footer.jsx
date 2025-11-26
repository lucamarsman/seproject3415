import React from "react";
import { Link } from "react-router-dom";
import Logo from "./Logo";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer-inner">
        {/* Column 1: Brand blurb */}
        <div className="footer-col">
          <Link to="/" className="footer-brand" aria-label="Go to Home">
            <Logo width={120} />
          </Link>
        </div>

        {/* Column 2: Product links */}
        <nav className="footer-col" aria-label="Footer navigation">
          <div className="footer-title">Product</div>
          <ul className="footer-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/browseRestaurants">Restaurants</Link></li>
            <li><Link to="/user">My Orders</Link></li>
          </ul>
        </nav>

        {/* Column 3: For restaurants */}
        <nav className="footer-col" aria-label="Restaurant links">
          <div className="footer-title">For Restaurants</div>
          <ul className="footer-links">
            <li><Link to="/restaurant">Dashboard</Link></li>
            <li><Link to="/browseRestaurants">Menu Manager</Link></li>
            <li><Link to="/restaurant">Orders</Link></li>
          </ul>
        </nav>

        {/* Column 4: Contact / social (placeholders) */}
        <div className="footer-col">
          <div className="footer-title">Contact</div>
          <ul className="footer-links">
            <li><a href="mailto:team@example.com">team@example.com</a></li>
            <li><a href="#" aria-label="Visit our GitHub repo">GitHub</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {year} Grab N Go</span>
        <span className="dot">•</span>
        <Link to="#" className="muted">Terms</Link>
        <span className="dot">•</span>
        <Link to="#" className="muted">Privacy</Link>
      </div>
    </footer>
  );
}

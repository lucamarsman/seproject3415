import { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import Navbar from "./components/NavBar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import UserPage from "./pages/UserPage";
import RestaurantPage from "./pages/RestaurantPage";
import CourierPage from "./pages/CourierPage";
import AdminPage from "./pages/AdminPage";
import OrderPage from "./pages/OrderPage";
import BrowseRestaurants from "./pages/BrowseRestaurants";
import MenuPage from "./pages/MenuPage";
import BecomeACustomer from "./pages/BecomeACustomer";
import BecomeARestaurant from "./pages/BecomeARestaurant";
import BecomeACourier from "./pages/BecomeACourier";
import SignUp from "./pages/SignUp";

import "leaflet/dist/leaflet.css";

function App() {
  const [role, setRole] = useState(
    () => localStorage.getItem("selectedRole") || null
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar
          onSelectRole={setRole}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login role={role} />} />
          <Route
            path="/user"
            element={<UserPage isSidebarOpen={isSidebarOpen} />}
          />
          <Route path="/restaurant" element={<RestaurantPage />} />
          <Route path="/courier" element={<CourierPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route
            path="/user/:restaurantName/:restaurantId/order"
            element={<OrderPage />}
          />
          <Route path="/browseRestaurants" element={<BrowseRestaurants />} />
          <Route path="/browseRestaurants/:id/menu" element={<MenuPage />} />
          <Route path="/become-a-customer" element={<BecomeACustomer />} />
          <Route path="/become-a-restaurant" element={<BecomeARestaurant />} />
          <Route path="/become-a-courier" element={<BecomeACourier />} />
          <Route path="/signup" element={<SignUp onSelectRole={setRole} />} />
        </Routes>

        <Footer />
      </div>
    </Router>
  );
}

export default App;

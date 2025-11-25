import React from "react";
import { useNavigate } from "react-router-dom";

export default function SignUp({ onSelectRole }) {
  const navigate = useNavigate();

  const handleRoleClick = (role) => {
    localStorage.setItem("selectedRole", role);
    onSelectRole?.(role);
    navigate("/login");
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] bg-gray-50 py-8">
      <h1 className="text-3xl font-bold mb-2">Sign Up</h1>
      <p className="text-gray-600 mb-6 text-center">Select your role to get started</p>

      <div className="flex flex-col md:flex-row gap-4">
        <button
          onClick={() => handleRoleClick("user")}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Customer
        </button>

        <button
          onClick={() => handleRoleClick("restaurant")}
          className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
        >
          Restaurant
        </button>

        <button
          onClick={() => handleRoleClick("courier")}
          className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition"
        >
          Courier
        </button>
      </div>
    </div>
  );
}
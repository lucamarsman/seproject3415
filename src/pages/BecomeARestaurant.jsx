import React from "react";

export default function BecomeARestaurant() {
    return (
        <div className="p-10 max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl font-bold text-center">Partner With Us</h1>
            <p className="text-lg text-gray-700 text-center">
                Join our platform and reach thousands of hungry customers every day.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                <div className="p-6 rounded-2xl shadow bg-white border">
                    <h2 className="text-2xl font-semibold mb-2">Increase Your Sales</h2>
                    <p className="text-gray-600">
                        Expand your customer base instantly. Our platform connects you with people looking for great food right now.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border">
                    <h2 className="text-2xl font-semibold mb-2">Easy Order Management</h2>
                    <p className="text-gray-600">
                        Manage online orders with a simple dashboard designed for speed and efficiency.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border">
                    <h2 className="text-2xl font-semibold mb-2">Marketing & Promotions</h2>
                    <p className="text-gray-600">
                        Get featured in promotions, deals, and special campaigns to boost visibility and revenue.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border">
                        <h2 className="text-2xl font-semibold mb-2">Reliable Courier Network</h2>
                        <p className="text-gray-600">
                            Our couriers ensure your meals are delivered quickly and professionally.
                        </p>
                </div>
            </div>
            <div className="flex justify-center mt-10">
                <a
                onClick={() => {
                    localStorage.setItem("selectedRole", "restaurant"); 
                }}
                href="/login"
                className="px-6 py-3 rounded-xl shadow transition"
                style={{ backgroundColor: "#F5F5DC", color: "black" }}
                >
                Sign Up Now
                </a>
            </div>
        </div>
    );
}

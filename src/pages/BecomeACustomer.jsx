import React from "react";

export default function BecomeACustomer() {
    return (
        <div className="p-10 max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl font-bold text-center">Why Become a Customer?</h1>
            <p className="text-lg text-gray-700 text-center">
                Enjoy fast delivery, delicious meals, and a seamless ordering experience.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                <div className="p-6 rounded-2xl shadow bg-white border">
                    <h2 className="text-2xl font-semibold mb-2">Huge Variety of Restaurants</h2>
                    <p className="text-gray-600">
                        From fast food to fine dining, discover new places or order from your
                        all-time favorites with just a few taps.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border">
                    <h2 className="text-2xl font-semibold mb-2">Fast & Reliable Delivery</h2>
                    <p className="text-gray-600">
                        Our couriers deliver your food hot, fresh, and right to your door.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border">
                    <h2 className="text-2xl font-semibold mb-2">Exclusive Deals & Rewards</h2>
                    <p className="text-gray-600">
                        Earn points, claim discounts, and enjoy regular promotions made just for you.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border">
                    <h2 className="text-2xl font-semibold mb-2">Simple, Smart Ordering</h2>
                    <p className="text-gray-600">
                        Reorder past meals, track your deliveries in real time, and customize meals
                        exactly how you like them.
                    </p>
                </div>
            </div>
            <div className="flex justify-center mt-10">
                <a
                onClick={() => {
                    localStorage.setItem("selectedRole", "user"); 
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

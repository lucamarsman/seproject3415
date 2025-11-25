import React from "react";

export default function BecomeACourier() {
    return (
        <div className="p-10 max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl font-bold text-center">Become a Courier</h1>
            <p className="text-lg text-gray-700 text-center">
                Earn money on your own schedule while delivering meals people love.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                <div className="p-6 rounded-2xl shadow bg-white border border border">
                    <h2 className="text-2xl font-semibold mb-2">Flexible Schedule</h2>
                    <p className="text-gray-600">
                        Work whenever you want! Mornings, evenings, weekends, or full‑time.
                        You choose your own hours.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border border border">
                    <h2 className="text-2xl font-semibold mb-2">Great Earnings</h2>
                    <p className="text-gray-600">
                        Earn per delivery, plus keep 100% of your tips. High‑demand times
                        can boost your income even more.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border border border">
                    <h2 className="text-2xl font-semibold mb-2">Easy to Start</h2>
                    <p className="text-gray-600">
                        Sign up, get approved, and start delivering quickly, no complicated
                        setup required.
                    </p>
                </div>

                <div className="p-6 rounded-2xl shadow bg-white border border border">
                    <h2 className="text-2xl font-semibold mb-2">Deliver Your Way</h2>
                    <p className="text-gray-600">
                        Use a bike, car, scooter, or whatever fits your lifestyle and your city.
                    </p>
                </div>
            </div>
            <div className="flex justify-center mt-10">
                <a
                onClick={() => {
                    localStorage.setItem("selectedRole", "courier"); 
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

export default function Home() {
  return (
    <div className="p-6">
      {/* <h1 className="text-3xl font-bold">Welcome to Delivery</h1>
      <p className="mt-2 text-gray-600">Choose a role from the top navigation bar to begin.</p> */}
      <div className="hero">
        <h1>🍔 Fresh Food, Fast Delivery</h1>
        <p>Order from your favorite local restaurants with just a few clicks.</p>
        <button className="primary-btn">Browse Restaurants</button>
      </div>

      <div className="sample-restaurants">
        <div className="restaurant-card">Pizza Palace</div>
        <div className="restaurant-card">Burger Hub</div>
        <div className="restaurant-card">Sushi World</div>
      </div>
    </div>
  );
}
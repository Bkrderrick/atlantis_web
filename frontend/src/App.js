import { useEffect, useState } from "react";
import "./App.css";
import axios from "axios";

const API = "http://localhost:5001/api";

function App() {
  const [items, setItems] = useState([]);

  const fetchAtlantisData = async () => {
    try {
      const response = await axios.get(`${API}/atlantis-data`);
      console.log("Data fetched from Atlas:", response.data);
      setItems(response.data);
    } catch (e) {
      console.error("Error fetching from backend:", e);
    }
  };

  useEffect(() => {
    fetchAtlantisData();
  }, []);

  return (
    <div style={{ padding: "40px", backgroundColor: "#001f3f", color: "white", minHeight: "100vh" }}>
      <h1>Atlantis Discovery Log</h1>
      <hr />
      <div style={{ display: "grid", gap: "20px", marginTop: "20px" }}>
        {items.length > 0 ? (
          items.map((item, index) => (
            <div key={index} style={{ border: "1px solid #0074D9", padding: "15px", borderRadius: "8px" }}>
              <h3>🔍 {item.name}</h3>
              <p><strong>Type:</strong> {item.type}</p>
              <p><strong>Status:</strong> {item.status}</p>
            </div>
          ))
        ) : (
          <p>Scanning the ocean floor for artifacts...</p>
        )}
      </div>
    </div>
  );
}

export default App;

// DEV: Testing RBAC - Remove this entire file after testing
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { Button } from "./ui/Button.jsx";

export function DevLoginSelector({ onSelectPerson, isOpen }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || people.length > 0) return;

    const fetchPeople = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from("people")
          .select("id, name, access")
          .eq("archived", false)
          .order("name");

        if (err) throw err;
        setPeople(data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPeople();
  }, [isOpen, people.length]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#1e2235",
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: "100%",
          border: "1px solid #2a2f45",
        }}
      >
        <h2 style={{ margin: "0 0 16px 0", color: "#f0f2f8", fontSize: 18, fontWeight: 700 }}>
          Select Person to Log In As
        </h2>

        {loading && <p style={{ color: "#9ba4b8" }}>Loading people from Supabase...</p>}
        {error && <p style={{ color: "#ef4444" }}>Error: {error}</p>}

        {!loading && people.length === 0 && !error && (
          <p style={{ color: "#7b82a0" }}>
            No people found in Supabase. Make sure you have people in your database.
          </p>
        )}

        {people.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
            {people.map((person) => (
              <button
                key={person.id}
                onClick={() => onSelectPerson(person)}
                style={{
                  padding: "12px 14px",
                  background: "#252a3d",
                  border: "1px solid #3a4060",
                  borderRadius: 8,
                  color: "#f0f2f8",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                  transition: "all 0.2s",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#2a2f45";
                  e.currentTarget.style.borderColor = "#0088ff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#252a3d";
                  e.currentTarget.style.borderColor = "#3a4060";
                }}
              >
                <span>{person.name}</span>
                <span style={{ fontSize: 12, color: "#9ba4b8" }}>
                  {person.access ? person.access.charAt(0).toUpperCase() + person.access.slice(1) : "Member"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
// DEV: End

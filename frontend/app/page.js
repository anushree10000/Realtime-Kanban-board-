"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getTokens, clearTokens } from "./lib/api";

export default function HomePage() {
  const router = useRouter();
  const [boards, setBoards] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const { accessToken } = getTokens();
    if (!accessToken) {
      router.push("/login");
      return;
    }
    apiFetch("/api/boards").then(setBoards).catch((e) => setError(e.message));
  }, [router]);

  async function createBoard(e) {
    e.preventDefault();
    try {
      const board = await apiFetch("/api/boards", {
        method: "POST",
        body: JSON.stringify({ title: newTitle }),
      });
      router.push(`/board/${board.id}`);
    } catch (e) {
      setError(e.message);
    }
  }

  function logout() {
    clearTokens();
    router.push("/login");
  }

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Your Boards</h2>
        <button style={{ width: "auto" }} onClick={logout}>
          Log out
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <form onSubmit={createBoard} style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          placeholder="New board title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button style={{ width: 140 }} type="submit">
          Create
        </button>
      </form>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {boards.map((b) => (
          <li key={b.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
            <Link href={`/board/${b.id}`}>{b.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

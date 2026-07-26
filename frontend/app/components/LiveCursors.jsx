"use client";

// Renders a colored dot + label for every other user's cursor position.
// `cursors` is a map of userId -> { x, y, email }, kept in the parent's
// state and updated from socket "cursor:move" events.
const COLORS = ["#e91e63", "#2196f3", "#4caf50", "#ff9800", "#9c27b0"];

function colorFor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function LiveCursors({ cursors }) {
  return (
    <>
      {Object.entries(cursors).map(([userId, c]) => (
        <div
          key={userId}
          className="remote-cursor"
          style={{ left: 0, top: 0, transform: `translate(${c.x}px, ${c.y}px)` }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={colorFor(userId)}>
              <path d="M4 2l16 8-7 2-2 7-7-17z" />
            </svg>
            <span className="remote-cursor-label" style={{ background: colorFor(userId) }}>
              {c.email || userId.slice(0, 6)}
            </span>
          </div>
        </div>
      ))}
    </>
  );
}

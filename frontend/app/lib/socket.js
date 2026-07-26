"use client";

import { io } from "socket.io-client";
import { getTokens } from "./api";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

let socket = null;

// One socket connection per browser tab, reused across the app rather than
// reconnecting per component — reconnect churn is a common source of
// "cursors go stale" bugs in collaborative apps.
export function getSocket() {
  if (socket) return socket;

  const { accessToken } = getTokens();
  socket = io(SOCKET_URL, {
    auth: { token: accessToken },
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

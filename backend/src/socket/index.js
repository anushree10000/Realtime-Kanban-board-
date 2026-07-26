import { verifyAccessToken } from "../auth.js";

export function registerSocketHandlers(io) {
  // Auth handshake: client sends its access token, we verify it before
  // allowing any room joins. Rejected sockets are disconnected immediately.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token ? verifyAccessToken(token) : null;
    if (!payload) return next(new Error("unauthorized"));
    socket.user = payload;
    next();
  });

  io.on("connection", (socket) => {
    let currentBoardId = null;

    socket.on("board:join", ({ boardId }) => {
      currentBoardId = boardId;
      socket.join(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit("presence:joined", {
        userId: socket.user.sub,
        email: socket.user.email,
      });
    });

    // Cursor position updates. The client throttles these to ~20/sec before
    // emitting, so this handler is intentionally dumb: just re-broadcast to
    // everyone else in the room.
    socket.on("cursor:move", ({ boardId, x, y }) => {
      socket.to(`board:${boardId}`).emit("cursor:move", {
        userId: socket.user.sub,
        x,
        y,
      });
    });

    // Card drag events get broadcast twice: once optimistically here for
    // sub-100ms perceived latency, and again from the REST handler once
    // the DB write is confirmed (see task.routes.js task:moved event).
    // Clients reconcile using the task id, so a duplicate is a no-op.
    socket.on("task:dragging", ({ boardId, taskId, toColumnId, toIndex }) => {
      socket.to(`board:${boardId}`).emit("task:dragging", {
        taskId,
        toColumnId,
        toIndex,
        movedBy: socket.user.sub,
      });
    });

    socket.on("disconnect", () => {
      if (currentBoardId) {
        socket.to(`board:${currentBoardId}`).emit("presence:left", {
          userId: socket.user.sub,
        });
      }
    });
  });
}

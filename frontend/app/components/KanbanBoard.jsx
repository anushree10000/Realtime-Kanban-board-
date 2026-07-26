"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import Column from "./Column";
import LiveCursors from "./LiveCursors";
import StatsChart from "./StatsChart";
import { apiFetch } from "../lib/api";
import { getSocket } from "../lib/socket";

// Simple throttle: only lets `fn` run once per `ms`. Used for cursor
// broadcasts so we don't emit a socket event on every single mousemove.
function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

export default function KanbanBoard({ boardId }) {
  const [board, setBoard] = useState(null);
  const [cursors, setCursors] = useState({});
  const [error, setError] = useState("");
  const socketRef = useRef(null);

  const loadBoard = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/boards/${boardId}`);
      setBoard(data);
    } catch (e) {
      setError(e.message);
    }
  }, [boardId]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Socket lifecycle: join the board room, listen for remote events, and
  // clean up listeners (but not the shared socket itself) on unmount.
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    socket.emit("board:join", { boardId });

    function onTaskMoved({ taskId, toColumnId, toIndex }) {
      setBoard((prev) => (prev ? applyMove(prev, taskId, toColumnId, toIndex) : prev));
    }

    function onTaskCreated(task) {
      setBoard((prev) => {
        if (!prev) return prev;
        const columns = prev.columns.map((c) =>
          c.id === task.columnId ? { ...c, tasks: [...c.tasks, task] } : c
        );
        return { ...prev, columns };
      });
    }

    function onTaskDeleted({ taskId }) {
      setBoard((prev) => {
        if (!prev) return prev;
        const columns = prev.columns.map((c) => ({
          ...c,
          tasks: c.tasks.filter((t) => t.id !== taskId),
        }));
        return { ...prev, columns };
      });
    }

    function onCursorMove({ userId, x, y }) {
      setCursors((prev) => ({ ...prev, [userId]: { ...prev[userId], x, y } }));
    }

    function onPresenceLeft({ userId }) {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    }

    socket.on("task:moved", onTaskMoved);
    socket.on("task:dragging", onTaskMoved);
    socket.on("task:created", onTaskCreated);
    socket.on("task:deleted", onTaskDeleted);
    socket.on("cursor:move", onCursorMove);
    socket.on("presence:left", onPresenceLeft);

    return () => {
      socket.off("task:moved", onTaskMoved);
      socket.off("task:dragging", onTaskMoved);
      socket.off("task:created", onTaskCreated);
      socket.off("task:deleted", onTaskDeleted);
      socket.off("cursor:move", onCursorMove);
      socket.off("presence:left", onPresenceLeft);
    };
  }, [boardId]);

  // Broadcast this user's mouse position, throttled to ~20/sec so the
  // socket isn't flooded on every native mousemove event.
  useEffect(() => {
    const emitCursor = throttle((x, y) => {
      socketRef.current?.emit("cursor:move", { boardId, x, y });
    }, 50);

    function handleMouseMove(e) {
      emitCursor(e.clientX, e.clientY);
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [boardId]);

  function applyMove(prevBoard, taskId, toColumnId, toIndex) {
    let movedTask = null;
    const strippedColumns = prevBoard.columns.map((c) => {
      const found = c.tasks.find((t) => t.id === taskId);
      if (found) movedTask = found;
      return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
    });
    if (!movedTask) return prevBoard;

    const columns = strippedColumns.map((c) => {
      if (c.id !== toColumnId) return c;
      const tasks = [...c.tasks];
      tasks.splice(toIndex, 0, { ...movedTask, columnId: toColumnId });
      return { ...c, tasks };
    });

    return { ...prevBoard, columns };
  }

  async function handleDragEnd(result) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Optimistic local update + immediate broadcast for perceived speed...
    setBoard((prev) => applyMove(prev, draggableId, destination.droppableId, destination.index));
    socketRef.current?.emit("task:dragging", {
      boardId,
      taskId: draggableId,
      toColumnId: destination.droppableId,
      toIndex: destination.index,
    });

    // ...then confirm with the server. On failure, reload from source of
    // truth to roll back the optimistic change.
    try {
      await apiFetch(`/api/boards/${boardId}/tasks/${draggableId}/move`, {
        method: "PATCH",
        body: JSON.stringify({ toColumnId: destination.droppableId, toIndex: destination.index }),
      });
    } catch (e) {
      setError(e.message);
      loadBoard();
    }
  }

  async function handleAddTask(columnId, title) {
    try {
      await apiFetch(`/api/boards/${boardId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, columnId }),
      });
      // Server emits task:created back to us too; loadBoard keeps things
      // simple and consistent rather than hand-rolling local insert here.
      loadBoard();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDeleteTask(taskId) {
    try {
      await apiFetch(`/api/boards/${boardId}/tasks/${taskId}`, { method: "DELETE" });
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!board) return <p>Loading board...</p>;

  return (
    <div className="board-page">
      <LiveCursors cursors={cursors} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <h2>{board.title}</h2>
        <StatsChart columns={board.columns} />
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="board-columns">
          {board.columns.map((col) => (
            <Column
              key={col.id}
              column={col}
              onAddTask={handleAddTask}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

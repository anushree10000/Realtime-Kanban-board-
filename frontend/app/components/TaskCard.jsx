"use client";

import { Draggable } from "@hello-pangea/dnd";

export default function TaskCard({ task, index, onDelete }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`task-card ${snapshot.isDragging ? "dragging" : ""}`}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{task.title}</span>
            <button
              onClick={() => onDelete(task.id)}
              style={{
                width: "auto",
                background: "none",
                color: "#6b778c",
                padding: 0,
                fontSize: 12,
              }}
              title="Delete task"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}

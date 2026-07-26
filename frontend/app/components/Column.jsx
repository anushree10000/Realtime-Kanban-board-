"use client";

import { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";
import TaskCard from "./TaskCard";

export default function Column({ column, onAddTask, onDeleteTask }) {
  const [newTitle, setNewTitle] = useState("");

  function handleAdd(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(column.id, newTitle.trim());
    setNewTitle("");
  }

  return (
    <div className="column">
      <div className="column-title">
        {column.title} ({column.tasks.length})
      </div>

      <Droppable droppableId={column.id}>
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} style={{ minHeight: 40 }}>
            {column.tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} onDelete={onDeleteTask} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      <form onSubmit={handleAdd} style={{ marginTop: 8 }}>
        <input
          placeholder="+ Add a task"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{ fontSize: 13, padding: "6px 8px" }}
        />
      </form>
    </div>
  );
}

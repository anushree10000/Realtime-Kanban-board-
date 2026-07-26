import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getMembership } from "./board.routes.js";

export const taskRouter = Router({ mergeParams: true });
taskRouter.use(requireAuth);

// All routes here are mounted at /api/boards/:boardId/tasks

taskRouter.post("/", async (req, res) => {
  const { title, columnId } = req.body;
  const membership = await getMembership(req.params.boardId, req.user.id);
  if (!membership) return res.status(403).json({ error: "No access to this board" });
  if (membership.role === "VIEWER") return res.status(403).json({ error: "Viewers cannot edit" });

  const count = await prisma.task.count({ where: { columnId } });
  const task = await prisma.task.create({
    data: { title, columnId, order: count },
  });

  req.app.get("io").to(`board:${req.params.boardId}`).emit("task:created", task);
  res.status(201).json(task);
});

// Called when a card is dropped into a new column/position. Updates the
// task's columnId + order, and re-indexes the rest of that column so
// there are no order gaps/collisions.
taskRouter.patch("/:taskId/move", async (req, res) => {
  const { toColumnId, toIndex } = req.body;
  const membership = await getMembership(req.params.boardId, req.user.id);
  if (!membership) return res.status(403).json({ error: "No access to this board" });
  if (membership.role === "VIEWER") return res.status(403).json({ error: "Viewers cannot edit" });

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: req.params.taskId },
      data: { columnId: toColumnId, order: toIndex },
    });

    const siblings = await tx.task.findMany({
      where: { columnId: toColumnId, id: { not: updated.id } },
      orderBy: { order: "asc" },
    });

    // Re-number siblings around the inserted position.
    let cursor = 0;
    for (const sibling of siblings) {
      if (cursor === toIndex) cursor++;
      await tx.task.update({ where: { id: sibling.id }, data: { order: cursor } });
      cursor++;
    }

    return updated;
  });

  req.app.get("io").to(`board:${req.params.boardId}`).emit("task:moved", {
    taskId: task.id,
    toColumnId,
    toIndex,
    movedBy: req.user.id,
  });

  res.json(task);
});

taskRouter.delete("/:taskId", async (req, res) => {
  const membership = await getMembership(req.params.boardId, req.user.id);
  if (!membership) return res.status(403).json({ error: "No access to this board" });
  if (membership.role === "VIEWER") return res.status(403).json({ error: "Viewers cannot edit" });

  await prisma.task.delete({ where: { id: req.params.taskId } });

  req.app.get("io").to(`board:${req.params.boardId}`).emit("task:deleted", {
    taskId: req.params.taskId,
  });

  res.status(204).send();
});

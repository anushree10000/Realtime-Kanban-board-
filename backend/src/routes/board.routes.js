import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const boardRouter = Router();
boardRouter.use(requireAuth);

// Shared authorization check: does req.user have at least `role` access
// on this board? Owner always has full access.
async function getMembership(boardId, userId) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return null;
  if (board.ownerId === userId) return { role: "EDITOR", board };

  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  return membership ? { role: membership.role, board } : null;
}

boardRouter.get("/", async (req, res) => {
  const boards = await prisma.board.findMany({
    where: {
      OR: [{ ownerId: req.user.id }, { members: { some: { userId: req.user.id } } }],
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(boards);
});

boardRouter.post("/", async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const board = await prisma.board.create({
    data: {
      title,
      ownerId: req.user.id,
      columns: {
        create: [
          { title: "To Do", order: 0 },
          { title: "In Progress", order: 1 },
          { title: "Done", order: 2 },
        ],
      },
    },
    include: { columns: true },
  });

  res.status(201).json(board);
});

boardRouter.get("/:id", async (req, res) => {
  const membership = await getMembership(req.params.id, req.user.id);
  if (!membership) return res.status(403).json({ error: "No access to this board" });

  const board = await prisma.board.findUnique({
    where: { id: req.params.id },
    include: {
      columns: { orderBy: { order: "asc" }, include: { tasks: { orderBy: { order: "asc" } } } },
    },
  });

  res.json({ ...board, myRole: membership.role });
});

boardRouter.post("/:id/members", async (req, res) => {
  const { userId, role } = req.body;
  const membership = await getMembership(req.params.id, req.user.id);
  if (!membership || membership.role !== "EDITOR") {
    return res.status(403).json({ error: "Only editors can add members" });
  }

  const member = await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId: req.params.id, userId } },
    update: { role: role || "EDITOR" },
    create: { boardId: req.params.id, userId, role: role || "EDITOR" },
  });

  res.status(201).json(member);
});

export { getMembership };

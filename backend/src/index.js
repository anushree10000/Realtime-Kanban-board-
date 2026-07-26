import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { authRouter } from "./routes/auth.routes.js";
import { boardRouter } from "./routes/board.routes.js";
import { taskRouter } from "./routes/task.routes.js";
import { registerSocketHandlers } from "./socket/index.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" },
});

// Stashed on the app so REST route handlers can emit socket events after a
// successful DB write (see task.routes.js).
app.set("io", io);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/boards", boardRouter);
app.use("/api/boards/:boardId/tasks", taskRouter);

registerSocketHandlers(io);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`API + WS server listening on :${PORT}`);
});

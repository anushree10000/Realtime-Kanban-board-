import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../auth.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    // Same error for "no such user" and "wrong password" — don't leak
    // which one it was.
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);

  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
    refreshToken,
  });
});

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken is required" });
  }

  const result = await rotateRefreshToken(refreshToken);
  if (!result) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  const user = await prisma.user.findUnique({ where: { id: result.userId } });
  const accessToken = signAccessToken(user);

  res.json({ accessToken, refreshToken: result.newRawToken });
});

authRouter.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.status(204).send();
});

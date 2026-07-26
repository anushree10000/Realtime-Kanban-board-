import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "./db.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL,
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Issues a new refresh token, stores only its hash in the DB (so a DB leak
// doesn't hand over usable tokens), and returns the raw token to the client.
export async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { tokenHash: hashToken(raw), userId, expiresAt },
  });

  return raw;
}

// Verifies a refresh token against the DB, then rotates it: the old one is
// marked revoked and a brand new one is issued. This limits the blast
// radius if a refresh token is ever stolen.
export async function rotateRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record || record.revoked || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revoked: true },
  });

  const newRawToken = await issueRefreshToken(record.userId);
  return { userId: record.userId, newRawToken };
}

export async function revokeRefreshToken(rawToken) {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
}

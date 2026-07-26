import { PrismaClient } from "@prisma/client";

// A single shared Prisma instance avoids exhausting Postgres connections
// in dev (Next.js-style hot reload isn't an issue here since this is a
// plain Node process, but keeping one client is still best practice).
export const prisma = new PrismaClient();

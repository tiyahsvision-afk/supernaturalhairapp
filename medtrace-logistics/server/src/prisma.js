import { PrismaClient } from "@prisma/client";

// A single shared client per process — Prisma pools connections internally,
// so a fresh client per request would exhaust the database's connection limit.
export const prisma = new PrismaClient();

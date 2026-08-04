import { PrismaClient } from '@prisma/client';

// Reuse a single client across hot reloads / serverless invocations.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma__ || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma__ = prisma;
}

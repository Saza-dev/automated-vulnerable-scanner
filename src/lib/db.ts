import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// In Prisma 7, you pass the URL directly to the adapter
const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db",
});

// Next.js Dev Mode Singleton pattern to prevent too many connections
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

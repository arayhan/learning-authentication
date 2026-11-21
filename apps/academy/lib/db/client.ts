import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set — copy apps/academy/.env.example to apps/academy/.env.local");

// Reuse the connection across Next dev hot reloads.
const g = globalThis as unknown as { __academyPg?: ReturnType<typeof postgres> };
const sql = (g.__academyPg ??= postgres(url, { max: 10 }));

export const db = drizzle(sql, { schema });

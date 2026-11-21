import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Reuse the connection across Next dev hot reloads.
const g = globalThis as unknown as { __academyPg?: ReturnType<typeof postgres> };
const sql = (g.__academyPg ??= postgres(process.env.DATABASE_URL!, { max: 10 }));

export const db = drizzle(sql, { schema });

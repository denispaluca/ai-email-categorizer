import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const sqliteDb = new Database(process.env.DB_PATH!);
export const db = drizzle(sqliteDb, { schema });

export type Database = typeof db;

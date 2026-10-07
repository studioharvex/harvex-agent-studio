import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Bind the D1 database as `DB` (vite.config.ts locally, the wrangler configuration on the server) before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

import { execSync } from "child_process";
import { Client } from "pg";
import { loadEnv } from "vite";

export default async function setup() {
  const env = loadEnv("test", process.cwd(), "");
  const url = new URL(env.DATABASE_URL);
  const dbName = url.pathname.slice(1);

  // Safety: never wipe a non-test database
  if (!dbName.includes("test")) {
    throw new Error(`Refusing to run tests against "${dbName}". Check .env.test`);
  }

  const adminUrl = new URL(env.DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  await client.end();

  execSync("npm run db:setup", { stdio: "inherit", env: { ...process.env, ...env } });
}
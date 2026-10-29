/**
 * Integration tests run against a dedicated database (sii_test). Before the run, all application tables are emptied
 * and the standard seed is loaded, so tests see realistic data. Set TEST_SKIP_RESEED=1 to reuse the last seed.
 */
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://sii:sii_dev@localhost:5432/sii_test?schema=public'

export default async function setup({ provide }: { provide?: unknown } = {}) {
  void provide
  if (!/sii_test|_test\b|test/.test(new URL(TEST_DB).pathname)) throw new Error(`Refusing to reset a database that is not named as a test database: ${TEST_DB}`)
  const onlyUnit = process.argv.some((a) => a.includes('tests/unit'))
  if (onlyUnit || process.env.TEST_SKIP_RESEED === '1') return
  const env = { ...process.env, DATABASE_URL: TEST_DB, APP_ENV: 'test', SEED_ADMIN_EMAIL: 'admin@test.local', SEED_ADMIN_PASSWORD: 'TestAdmin!2026-xyz', SEED_DEMO_USERS: 'true', STORAGE_DIR: './storage-test', APP_SECRET: process.env.APP_SECRET ?? 'test-secret-not-for-production-use-000000000000' }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env, stdio: 'ignore' })
  const db = new PrismaClient({ datasourceUrl: TEST_DB })
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  // TRUNCATE does not fire the row-level append-only trigger on AuditLog; this only ever runs on the test database.
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`)
  await db.$disconnect()
  execFileSync('npx', ['tsx', 'seed/seed.ts'], { env, stdio: 'ignore' })
}

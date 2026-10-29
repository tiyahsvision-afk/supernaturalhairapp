// Tests run against a dedicated database. Never point this at production data.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://sii:sii_dev@localhost:5432/sii_test?schema=public'
process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-secret-not-for-production-use-000000000000'
process.env.APP_ENV = 'test'
process.env.MFA_ENFORCEMENT = 'required'
process.env.STORAGE_DIR = process.env.STORAGE_DIR ?? './storage-test'

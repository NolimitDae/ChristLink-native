// e2e tests use their own database and Redis db 1 on the local docker compose services (docker compose up -d).
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL || 'postgresql://christlink:christlink@localhost:5433/christlink_test';
process.env.REDIS_URL = process.env.E2E_REDIS_URL || 'redis://localhost:6380/1';
process.env.JWT_SECRET = 'e2e-secret-0123456789abcdef0123456789abcdef';
process.env.REVIEW_EMAIL = 'review@example.com';
process.env.REVIEW_CODE = '424242';
delete process.env.RESEND_API_KEY;

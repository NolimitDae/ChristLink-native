import { readFileSync } from 'fs';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { configureApi } from '../src/bootstrap';

/**
 * Every route the native app calls (the table in __tests__/lib/api-contract.test.ts) must exist here.
 * A route exists when the response is anything but Nest's "Cannot <METHOD> <path>" 404.
 */
const contract = readFileSync(join(__dirname, '../../__tests__/lib/api-contract.test.ts'), 'utf8');
const routes = [...contract.matchAll(/'(GET|POST|PATCH|PUT|DELETE)',\s*'(\/[^']+)'/g)].map(([, method, path]) => ({
  method: method.toLowerCase() as 'get' | 'post' | 'patch' | 'put' | 'delete',
  path,
}));

describe('Native app route contract (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApi(moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true }));
    await app.init();
  });
  afterAll(() => app.close());

  it('reads the contract table', () => expect(routes.length).toBeGreaterThan(50));

  it.each(routes.map((r) => [r.method.toUpperCase(), r.path, r] as const))('%s %s exists', async (_m, _p, r) => {
    const res = await request(app.getHttpServer())[r.method](r.path).send({});
    const missing = res.status === 404 && /^Cannot (GET|POST|PATCH|PUT|DELETE)/.test(res.body?.error ?? res.body?.message ?? '');
    expect(missing).toBe(false);
  });
});

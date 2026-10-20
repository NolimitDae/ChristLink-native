import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/auth.decorators';
import { HealthService } from './health.service';

// GET /api/health (Railway healthcheck). The root GET /health is registered in bootstrap.ts.
@Public()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  async get(@Res() res: Response) {
    const { status, body } = await this.health.report();
    res.status(status).json(body);
  }
}

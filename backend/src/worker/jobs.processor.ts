import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_JOBS } from '../queues/queues';
import { REPEATABLE_JOBS } from './jobs';

@Processor(QUEUE_JOBS)
export class JobsProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger('Jobs');

  constructor(
    private readonly prisma: PrismaService,
    private readonly ref: ModuleRef,
    @InjectQueue(QUEUE_JOBS) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    const wanted = new Set(REPEATABLE_JOBS.map((j) => j.name));
    for (const s of await this.queue.getJobSchedulers()) {
      if (s.key && !wanted.has(s.key)) await this.queue.removeJobScheduler(s.key);
    }
    for (const j of REPEATABLE_JOBS) {
      await this.queue.upsertJobScheduler(j.name, { pattern: j.pattern, tz: 'UTC' }, { name: j.name });
    }
  }

  async process(job: Job) {
    const def = REPEATABLE_JOBS.find((j) => j.name === job.name);
    if (!def) return this.logger.warn(`No job named ${job.name}`);
    const result = await def.run(this.prisma, this.ref);
    this.logger.log(`${job.name} done`);
    return result;
  }
}

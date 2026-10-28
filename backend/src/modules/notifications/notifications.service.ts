import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PushJob, QUEUE_PUSH } from '../../queues/queues';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_PUSH) private readonly pushQueue: Queue<PushJob>,
  ) {}

  /** Inserts a notifications row (in-app inbox) and queues a push to the user's devices. */
  async create(userId: string, type: string, title: string, body?: string | null, data?: Record<string, unknown>) {
    const row = await this.prisma.notifications.create({
      data: { user_id: userId, type, title, body: body ?? null, data: (data ?? {}) as object },
    });
    await this.pushQueue.add(
      'push',
      { notificationId: row.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 },
    );
    return row;
  }
}

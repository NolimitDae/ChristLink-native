import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { PushJob, QUEUE_PUSH } from '../../queues/queues';

const JOB_OPTS = { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 };
const BATCH = 500;

export interface NewNotification {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
}

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
    await this.pushQueue.add('push', { notificationId: row.id }, JOB_OPTS);
    return row;
  }

  /**
   * The same notification for many people (followers, waitlist, everyone who prayed): one insert and one bulk queue
   * add per batch instead of two round trips per person.
   */
  async createMany(rows: NewNotification[]) {
    let created = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const inserted = await this.prisma.notifications.createManyAndReturn({
        data: batch.map((r) => ({ user_id: r.userId, type: r.type, title: r.title, body: r.body ?? null, data: (r.data ?? {}) as object })),
        select: { id: true },
      });
      await this.pushQueue.addBulk(inserted.map((n) => ({ name: 'push', data: { notificationId: n.id }, opts: JOB_OPTS })));
      created += inserted.length;
    }
    return created;
  }
}

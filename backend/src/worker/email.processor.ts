import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService } from '../modules/email/email.service';
import { EmailJob, QUEUE_EMAIL } from '../queues/queues';

/** Queue an email with `@InjectQueue(QUEUE_EMAIL) queue` → `queue.add('email', { to, subject, html, text })`. */
@Processor(QUEUE_EMAIL)
export class EmailProcessor extends WorkerHost {
  constructor(private readonly email: EmailService) {
    super();
  }

  async process(job: Job<EmailJob>) {
    await this.email.send(job.data);
  }
}

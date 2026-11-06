export const QUEUE_PUSH = 'push';
export const QUEUE_EMAIL = 'email';
export const QUEUE_JOBS = 'jobs';

export interface PushJob {
  notificationId: string;
}

export interface EmailJob {
  to: string;
  subject: string;
  html: string;
  text: string;
}

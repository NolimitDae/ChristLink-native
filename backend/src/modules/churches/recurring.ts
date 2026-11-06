import { BadRequestException } from '@nestjs/common';

export interface RecurringInput {
  name?: string;
  description?: string | null;
  event_type?: string | null;
  frequency?: string;
  weekday?: number | null;
  day_of_month?: number | null;
  start_time?: string;
  duration_minutes?: number;
  starts_on?: string;
  ends_on?: string | null;
  location?: string | null;
  is_service?: boolean;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const bad = (m: string) => new BadRequestException(m);

/**
 * Checks the merged row against the table's constraints (so bad input is a 400, not a 500) and converts time/date
 * strings for Prisma. `existing` holds the stored values on update.
 */
export function toRecurringData(input: RecurringInput, existing?: { frequency: string; weekday: number | null; day_of_month: number | null }) {
  const s = (v: unknown) => v === undefined || v === null || typeof v === 'string';
  const int = (v: unknown, lo: number, hi: number) => v === undefined || v === null || (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi);
  if (!existing && (typeof input.name !== 'string' || !input.start_time || !input.frequency)) {
    throw bad('Name, frequency and start time are required.');
  }
  if (input.name !== undefined && (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 120)) {
    throw bad('Name must be 2 to 120 characters.');
  }
  if (input.frequency !== undefined && !['weekly', 'biweekly', 'monthly'].includes(input.frequency)) throw bad('Unknown frequency.');
  if (!int(input.weekday, 0, 6)) throw bad('Weekday must be 0 to 6.');
  if (!int(input.day_of_month, 1, 28)) throw bad('Day of month must be 1 to 28.');
  if (input.duration_minutes !== undefined && !(Number.isInteger(input.duration_minutes) && input.duration_minutes >= 15 && input.duration_minutes <= 1440)) {
    throw bad('Duration must be 15 to 1440 minutes.');
  }
  if (input.start_time !== undefined && !TIME.test(String(input.start_time))) throw bad('Start time must be HH:MM.');
  if (input.starts_on !== undefined && !DATE.test(String(input.starts_on))) throw bad('Start date must be YYYY-MM-DD.');
  if (input.ends_on != null && !DATE.test(String(input.ends_on))) throw bad('End date must be YYYY-MM-DD.');
  if (![input.description, input.event_type, input.location].every(s)) throw bad('Invalid text field.');
  if (input.is_service !== undefined && typeof input.is_service !== 'boolean') throw bad('is_service must be true or false.');

  const frequency = input.frequency ?? existing?.frequency;
  const weekday = input.weekday !== undefined ? input.weekday : existing?.weekday ?? null;
  const dayOfMonth = input.day_of_month !== undefined ? input.day_of_month : existing?.day_of_month ?? null;
  if (frequency === 'monthly' ? dayOfMonth == null : weekday == null) {
    throw bad(frequency === 'monthly' ? 'Monthly events need a day of the month.' : 'Weekly events need a weekday.');
  }

  return {
    name: input.name?.trim(),
    description: input.description,
    event_type: input.event_type,
    frequency: input.frequency,
    weekday: input.weekday,
    day_of_month: input.day_of_month,
    start_time: input.start_time ? new Date(`1970-01-01T${input.start_time.length === 5 ? `${input.start_time}:00` : input.start_time}Z`) : undefined,
    duration_minutes: input.duration_minutes,
    starts_on: input.starts_on ? new Date(`${input.starts_on}T00:00:00Z`) : undefined,
    ends_on: input.ends_on === undefined ? undefined : input.ends_on === null ? null : new Date(`${input.ends_on}T00:00:00Z`),
    location: input.location,
    is_service: input.is_service,
  };
}

/** Prisma returns time/date columns as Dates; the app expects Postgres text ("19:00:00", "2026-10-20"). */
export function recurringOut<T extends { start_time: Date; starts_on: Date; ends_on: Date | null }>(row: T) {
  return {
    ...row,
    start_time: row.start_time.toISOString().slice(11, 19),
    starts_on: row.starts_on.toISOString().slice(0, 10),
    ends_on: row.ends_on ? row.ends_on.toISOString().slice(0, 10) : null,
  };
}

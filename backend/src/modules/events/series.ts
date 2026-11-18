import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import {
  HORIZON_DAYS,
  MAX_SERIES_DAYS,
  endOfLocalDay,
  fromWallTime,
  isRepeatRule,
  isTimeZone,
  nextOccurrences,
  wallTime,
  type RepeatRule,
} from './recurrence';

/**
 * Repeating free events (docs/RECURRING.md). A series row keeps the rule, the host's time zone and the first date's
 * start (the anchor); every date is an ordinary events row with series_id + series_index, so RSVPs, reminders,
 * check-in and the forum work per date. Dates exist up to HORIZON_DAYS ahead; the hourly job adds the next ones.
 */
const log = new Logger('Series');

export interface RepeatInput {
  rule: RepeatRule;
  timezone: string;
  /** Last day it may happen, end of that day in the host's zone; null = keeps going (up to a year). */
  until: Date | null;
}

/** `body.repeat` → a validated rule, null to remove it, or undefined when absent. */
export function parseRepeat(v: unknown, start: Date | null): RepeatInput | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === false) return null;
  if (typeof v !== 'object') throw new BadRequestException('Invalid repeat.');
  const r = v as Record<string, unknown>;
  if (!isRepeatRule(r.rule)) throw new BadRequestException('Choose how often it repeats: weekly, every 2 weeks or monthly.');
  const timezone = isTimeZone(r.timezone) ? r.timezone : 'America/New_York';
  let until: Date | null = null;
  if (r.until !== undefined && r.until !== null && r.until !== '') {
    until = typeof r.until === 'string' ? endOfLocalDay(r.until, timezone) : null;
    if (!until) throw new BadRequestException('Invalid repeat end date.');
    if (start && until.getTime() < start.getTime()) throw new BadRequestException('The repeat end date is before the first date.');
    if (start && until.getTime() > start.getTime() + MAX_SERIES_DAYS * 86_400_000) {
      throw new BadRequestException('A repeating event can run for up to a year. Pick an earlier end date.');
    }
  }
  return { rule: r.rule, timezone, until };
}

const durationMinutes = (start: Date | null, end: Date | null) =>
  start && end && end > start ? Math.round((end.getTime() - start.getTime()) / 60_000) : null;

/** Fields a new date copies from the latest date of its series. */
const COPY = {
  host_id: true, name: true, description: true, emoji: true, event_type: true, age_group: true, format: true,
  denomination: true, tags: true, venue_name: true, address: true, city: true, state: true, zip: true, online_url: true,
  max_capacity: true, cover_url: true, image_url: true, gallery_urls: true, forum_enabled: true, lat: true, lng: true,
  requires_approval: true,
} as const;

/**
 * Adds the dates of a series that fall inside the horizon. Only for a live series: one whose first date the host has
 * published (drafts and scheduled ones wait until they go live). Returns how many dates were added.
 */
export async function topUpSeries(prisma: PrismaService, seriesId: string, now = new Date()): Promise<number> {
  const series = await prisma.event_series.findUnique({ where: { id: seriesId } });
  if (!series || series.ended_at || !isRepeatRule(series.rule)) return 0;
  const dates = await prisma.events.findMany({
    where: { series_id: seriesId },
    orderBy: { series_index: 'desc' },
    select: { id: true, series_index: true, status: true, ...COPY },
  });
  if (!dates.some((d) => d.status === 'published')) return 0;
  const latest = dates[0];
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
  const next = nextOccurrences(series.anchor_start, series.rule, series.timezone, latest.series_index ?? 0, horizon, series.until);
  if (!next.length) return 0;
  const { id: _id, series_index: _i, status: _s, ...copy } = latest;
  const { count } = await prisma.events.createMany({
    data: next.map((o) => ({
      ...copy,
      tags: copy.tags ?? [],
      series_id: seriesId,
      series_index: o.index,
      start_date: o.start,
      end_date: series.duration_minutes ? new Date(o.start.getTime() + series.duration_minutes * 60_000) : null,
      is_paid: false,
      status: 'published',
    })),
    // The unique (series_id, series_index) index makes a second worker's insert a no-op
    skipDuplicates: true,
  });
  return count;
}

/** Hourly: every live series gets its next dates. */
export async function topUpAllSeries(prisma: PrismaService, cache?: CacheService, now = new Date()) {
  const active = await prisma.event_series.findMany({
    where: { ended_at: null, OR: [{ until: null }, { until: { gt: now } }] },
    select: { id: true },
  });
  let added = 0;
  for (const s of active) {
    try {
      added += await topUpSeries(prisma, s.id, now);
    } catch (e) {
      log.error(`series ${s.id}: ${(e as Error).message}`);
    }
  }
  if (added && cache) await cache.bump('events');
  return { series: active.length, added };
}

/** Creates the series row for a new first date (inside the caller's transaction). */
export async function createSeries(tx: Prisma.TransactionClient, hostId: string, repeat: RepeatInput, start: Date, end: Date | null) {
  return tx.event_series.create({
    data: {
      host_id: hostId,
      rule: repeat.rule,
      timezone: repeat.timezone,
      anchor_start: start,
      duration_minutes: durationMinutes(start, end),
      until: repeat.until,
    },
  });
}

/** Keeps the series rule in step when the host edits the first date of a series that isn't live yet. */
export async function syncDraftSeries(
  prisma: PrismaService,
  ev: { id: string; host_id: string; series_id: string | null; start_date: Date | null; end_date: Date | null },
  repeat: RepeatInput | null | undefined,
) {
  if (repeat === undefined) {
    if (ev.series_id && ev.start_date) {
      await prisma.event_series.update({
        where: { id: ev.series_id },
        data: { anchor_start: ev.start_date, duration_minutes: durationMinutes(ev.start_date, ev.end_date) },
      });
    }
    return;
  }
  if (repeat === null) {
    if (ev.series_id) {
      await prisma.events.update({ where: { id: ev.id }, data: { series_id: null, series_index: null } });
      await prisma.event_series.delete({ where: { id: ev.series_id } });
    }
    return;
  }
  if (!ev.start_date) throw new BadRequestException('Choose when it starts before making it repeat.');
  const data = {
    rule: repeat.rule,
    timezone: repeat.timezone,
    until: repeat.until,
    anchor_start: ev.start_date,
    duration_minutes: durationMinutes(ev.start_date, ev.end_date),
  };
  if (ev.series_id) {
    await prisma.event_series.update({ where: { id: ev.series_id }, data });
  } else {
    const s = await prisma.event_series.create({ data: { ...data, host_id: ev.host_id } });
    await prisma.events.update({ where: { id: ev.id }, data: { series_id: s.id, series_index: 0 } });
  }
}

/**
 * "This and later dates": the same changes on every later date of the series that hasn't happened. A new time moves each
 * date to that time of day (and by the same number of days), on the host's wall clock; future dates follow too.
 */
export async function applyToUpcoming(
  prisma: PrismaService,
  ev: { id: string; series_id: string; start_date: Date | null; end_date: Date | null },
  fields: Record<string, unknown>,
  now = new Date(),
) {
  const series = await prisma.event_series.findUnique({ where: { id: ev.series_id } });
  if (!series) return { ids: [] as string[] };
  const { start_date, end_date, sales_cutoff: _cut, ...shared } = fields as { start_date?: Date | null; end_date?: Date | null; sales_cutoff?: unknown };
  const others = await prisma.events.findMany({
    // "This and later dates": earlier dates keep their details even if they haven't happened yet
    where: {
      series_id: ev.series_id,
      id: { not: ev.id },
      status: { in: ['published', 'draft'] },
      start_date: { gte: ev.start_date && ev.start_date > now ? ev.start_date : now },
    },
    select: { id: true, start_date: true },
  });

  let move: ((d: Date) => Date) | null = null;
  let duration = series.duration_minutes;
  if (start_date instanceof Date && ev.start_date) {
    const tz = series.timezone;
    const before = wallTime(ev.start_date, tz);
    const after = wallTime(start_date, tz);
    const dayShift = Math.round(
      (Date.UTC(after.y, after.m, after.d) - Date.UTC(before.y, before.m, before.d)) / 86_400_000,
    );
    move = (d: Date) => {
      const w = wallTime(d, tz);
      return fromWallTime(w.y, w.m, w.d + dayShift, after.h, after.min, tz);
    };
    duration = durationMinutes(start_date, (end_date as Date | null | undefined) ?? ev.end_date) ?? duration;
    const a = wallTime(series.anchor_start, tz);
    await prisma.event_series.update({
      where: { id: series.id },
      data: { anchor_start: fromWallTime(a.y, a.m, a.d + dayShift, after.h, after.min, tz), duration_minutes: duration },
    });
  } else if (end_date !== undefined) {
    duration = durationMinutes(ev.start_date, end_date ?? null);
    await prisma.event_series.update({ where: { id: series.id }, data: { duration_minutes: duration } });
  }

  for (const o of others) {
    const start = move && o.start_date ? move(o.start_date) : o.start_date;
    const dates =
      move || end_date !== undefined
        ? { start_date: start, end_date: duration && start ? new Date(start.getTime() + duration * 60_000) : null }
        : {};
    await prisma.events.update({ where: { id: o.id }, data: { ...shared, ...dates, updated_at: now } });
  }
  return { ids: others.map((o) => o.id) };
}

/** What the event page shows about the series: the rule and the next dates (including this one). */
export async function seriesSummary(prisma: PrismaService, seriesId: string, includeDrafts: boolean, now = new Date()) {
  const series = await prisma.event_series.findUnique({ where: { id: seriesId } });
  if (!series) return null;
  const dates = await prisma.events.findMany({
    where: {
      series_id: seriesId,
      status: { in: includeDrafts ? ['published', 'cancelled', 'draft'] : ['published', 'cancelled'] },
      OR: [{ end_date: { gte: now } }, { start_date: { gte: now } }],
    },
    orderBy: { start_date: 'asc' },
    take: 12,
    select: { id: true, start_date: true, status: true },
  });
  return {
    id: series.id,
    rule: series.rule,
    timezone: series.timezone,
    until: series.until,
    ended: !!series.ended_at,
    dates,
  };
}

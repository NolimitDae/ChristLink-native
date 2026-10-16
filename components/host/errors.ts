import { ApiError } from '../../lib/api';
import { FeatureError } from '../../lib/features';

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError || err instanceof FeatureError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isNotSetUp(err: unknown): boolean {
  return err instanceof FeatureError && err.notSetUp;
}

export function readString(row: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

export function readRecord(row: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = row[key];
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

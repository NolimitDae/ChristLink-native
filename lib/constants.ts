import { logger } from './logger';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PK ?? '';
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? '';
export const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

if (__DEV__) {
  if (!SUPABASE_URL) logger.warn('EXPO_PUBLIC_SUPABASE_URL is not set');
  if (!SUPABASE_ANON) logger.warn('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set');
  if (!STRIPE_PK) logger.warn('EXPO_PUBLIC_STRIPE_PK is not set');
  if (!API_BASE) logger.warn('EXPO_PUBLIC_API_BASE is not set');
}

export const COLORS = {
  dark: {
    bg: '#0A0A0F',
    bg2: '#111118',
    surface: '#16161F',
    surface2: '#1E1E2A',
    surface3: '#252533',
    border: 'rgba(255,255,255,0.07)',
    border2: 'rgba(255,255,255,0.12)',
    gold: '#C9A84C',
    gold2: '#E8C97A',
    goldDim: 'rgba(201,168,76,0.15)',
    goldGlow: 'rgba(201,168,76,0.25)',
    text: '#F0EBE0',
    muted: '#666070',
    muted2: '#9994A8',
    red: '#E05050',
    green: '#4EC98C',
  },
  light: {
    bg: '#F5F0E8',
    bg2: '#EDE8DE',
    surface: '#FFFFFF',
    surface2: '#F8F4EE',
    surface3: '#EDE8DE',
    border: 'rgba(0,0,0,0.09)',
    border2: 'rgba(0,0,0,0.15)',
    gold: '#A07828',
    gold2: '#C9A84C',
    goldDim: 'rgba(160,120,40,0.12)',
    goldGlow: 'rgba(160,120,40,0.20)',
    text: '#1C160E',
    muted: '#8A8070',
    muted2: '#5E5848',
    red: '#C03030',
    green: '#2A8A5E',
  },
} as const;

export const EVENT_TYPES = [
  'All',
  'Worship',
  'Bible Study',
  'Retreat',
  'Youth',
  'Concert',
  'Prayer',
  'Conference',
  'Community',
  'Fellowship',
  'Outreach',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_FORMATS = ['in_person', 'online', 'hybrid'] as const;
export type EventFormat = (typeof EVENT_FORMATS)[number];

export const AGE_GROUPS = ['All Ages', 'Kids', 'Youth', 'Young Adults', 'Adults', 'Seniors'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const AVATAR_COLORS = [
  '#C9A84C',
  '#4EC98C',
  '#E05050',
  '#5B8EE6',
  '#B06AE0',
  '#E8804C',
  '#4CBFE8',
] as const;

export const API_TIMEOUT_MS = 15000;
export const API_MAX_RETRIES = 3;

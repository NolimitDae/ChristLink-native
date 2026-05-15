export const SUPABASE_URL = 'https://iqosvigdelnmarecpkkp.supabase.co';
export const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlxb3N2aWdkZWxubWFyZWNwa2twIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4MzIxMDAsImV4cCI6MjA1NTQwODEwMH0.t_JxFKmpHMNEpyAh7PGJV2OEfhBVR6YL_yJXPbCNW3Q';
export const STRIPE_PK =
  'pk_live_51Stha81sOqETIDGD9a01hbSMl0gLoYCvFvyhOhFJTA7W4pOFizj6csfIZzWv5Uyr00x4nBaHbHh0cWmomMsgZSlH00tAt9sbhf';
export const API_BASE = 'https://christlink1-production.up.railway.app';

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

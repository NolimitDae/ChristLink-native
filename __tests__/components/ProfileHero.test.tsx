jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), Link: ({ children }: { children: unknown }) => children }));
import React from 'react';
import { render } from '@testing-library/react-native';
import { ProfileHero } from '../../components/profile/ProfileHero';
import { ThemeProvider } from '../../contexts/ThemeContext';
import type { Profile } from '../../lib/types';

const base: Profile = { id: 'u1', full_name: 'Grace Lee', role: 'attendee', created_at: '2026-11-01T00:00:00Z' };
const hero = (p: Profile) => (
  <ThemeProvider>
    <ProfileHero profile={p} />
  </ThemeProvider>
);
const avatarStyle = (json: string) => json.match(/"borderColor":"([^"]+)"/g) ?? [];

describe('ProfileHero ring', () => {
  it('draws the ring colour picked in Edit profile', () => {
    const json = JSON.stringify(render(hero({ ...base, avatar_ring_color: '#9B5DE5' })).toJSON());
    expect(avatarStyle(json)).toContain('"borderColor":"#9B5DE5"');
  });

  it('changes when the ring changes', () => {
    const view = render(hero({ ...base, avatar_ring_color: '#9B5DE5' }));
    view.rerender(hero({ ...base, avatar_ring_color: '#55BFD6' }));
    const json = JSON.stringify(view.toJSON());
    expect(avatarStyle(json)).toContain('"borderColor":"#55BFD6"');
    expect(json).not.toContain('#9B5DE5');
  });

  it('has no coloured ring for "No ring"', () => {
    const json = JSON.stringify(render(hero({ ...base, avatar_ring_color: null })).toJSON());
    expect(json).not.toContain('#9B5DE5');
    expect(json).not.toContain('"borderColor":"#C9A84C"');
  });
});

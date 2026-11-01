import { Linking } from 'react-native';

const mockCreate = jest.fn();
jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: (...a: unknown[]) => mockCreate(...a) }));

import { addToCalendar } from '../../lib/calendar';

const entry = { title: 'Night of Worship', start: '2026-11-20T00:00:00.000Z', location: 'The Tabernacle' };

describe('addToCalendar', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  it('opens the system sheet with a two-hour default and reports a save', async () => {
    mockCreate.mockResolvedValue({ action: 'saved' });
    await expect(addToCalendar(entry)).resolves.toBe('saved');
    const data = mockCreate.mock.calls[0][0];
    expect(data.title).toBe('Night of Worship');
    expect(data.endDate.toISOString()).toBe('2026-11-20T02:00:00.000Z');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('passes a cancel through without opening anything else', async () => {
    mockCreate.mockResolvedValue({ action: 'canceled' });
    await expect(addToCalendar(entry)).resolves.toBe('canceled');
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it('falls back to Google Calendar when the native sheet fails (older builds)', async () => {
    mockCreate.mockRejectedValue(new Error('Cannot find native module ExpoCalendar'));
    await expect(addToCalendar(entry)).resolves.toBe('opened');
    expect((Linking.openURL as jest.Mock).mock.calls[0][0]).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  });
});

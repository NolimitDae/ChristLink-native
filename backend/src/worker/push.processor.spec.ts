import { inQuietHours } from './push.processor';
import { parseDataUrl } from '../modules/storage/storage.service';

describe('inQuietHours', () => {
  it('handles same-day and overnight windows', () => {
    expect(inQuietHours(13, 15, 14)).toBe(true);
    expect(inQuietHours(13, 15, 15)).toBe(false);
    expect(inQuietHours(22, 7, 23)).toBe(true);
    expect(inQuietHours(22, 7, 3)).toBe(true);
    expect(inQuietHours(22, 7, 12)).toBe(false);
    expect(inQuietHours(null, 7, 3)).toBe(false);
    expect(inQuietHours(5, 5, 5)).toBe(false);
  });
});

describe('parseDataUrl', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');

  it('accepts a real PNG', () => {
    expect(parseDataUrl(`data:image/png;base64,${png}`).type).toBe('image/png');
  });

  it('rejects disallowed types, mismatched content and oversize files', () => {
    expect(() => parseDataUrl(`data:text/html;base64,${png}`)).toThrow('Unsupported file type.');
    expect(() => parseDataUrl(`data:image/jpeg;base64,${png}`)).toThrow('does not match');
    expect(() => parseDataUrl(`data:image/png;base64,${png}`, { maxBytes: 4 })).toThrow('under');
    expect(() => parseDataUrl('nope')).toThrow('Invalid image data.');
  });
});

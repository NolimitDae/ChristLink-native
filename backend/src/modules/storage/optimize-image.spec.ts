import sharp = require('sharp');
import { optimizeImage } from './storage.service';

describe('optimizeImage', () => {
  it('turns a large PNG into a smaller WebP no wider than the limit', async () => {
    const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 160, b: 80 } } }).png().toBuffer();
    const out = await optimizeImage(png, 1600);
    expect(out).not.toBeNull();
    const meta = await sharp(out!).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(1067);
    expect(out!.length).toBeLessThan(png.length);
  });

  it('never enlarges small images', async () => {
    const jpg = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#333' } }).jpeg().toBuffer();
    expect((await sharp((await optimizeImage(jpg, 600))!).metadata()).width).toBe(300);
  });

  it('returns null for data it cannot decode, so the caller keeps the original', async () => {
    await expect(optimizeImage(Buffer.from('not an image'), 600)).resolves.toBeNull();
  });
});

import { StorageService } from './storage.service';

describe('StorageService public uploads', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('refuses a public upload when R2_PUBLIC_URL is missing, before storing anything', async () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'id';
    process.env.R2_SECRET_ACCESS_KEY = 'secret';
    process.env.R2_BUCKET = 'christlink-media';
    delete process.env.R2_PUBLIC_URL;
    const storage = new StorageService();
    const put = jest.spyOn(storage as unknown as { put: () => Promise<void> }, 'put');
    await expect(storage.putDataUrl('avatars', 'u1', 'data:image/png;base64,AAAA')).rejects.toMatchObject({ status: 503 });
    expect(put).not.toHaveBeenCalled();
  });
});

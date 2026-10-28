function redisConfig() {
  // Railway's Redis service exposes REDIS_URL and REDISHOST/REDISPORT/REDISPASSWORD
  const url = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;
  return {
    host: process.env.REDISHOST || url?.hostname || '127.0.0.1',
    port: Number(process.env.REDISPORT || url?.port || 6379),
    username: process.env.REDISUSER || (url?.username ? decodeURIComponent(url.username) : undefined),
    password: process.env.REDISPASSWORD || (url?.password ? decodeURIComponent(url.password) : ''),
    // redis://host:port/1 selects database 1 (the e2e tests use it)
    db: Number(url?.pathname?.slice(1) || 0),
    // 0 = IPv4 or IPv6; Railway private networking (*.railway.internal) is IPv6-only
    family: 0,
  };
}

export default () => ({
  app: {
    name: process.env.APP_NAME || 'ChristLink',
    role: process.env.ROLE === 'worker' ? 'worker' : 'api',
    port: Number(process.env.PORT || 4000),
    client_app_url: process.env.CLIENT_APP_URL,
    cors_origins: (process.env.CORS_ORIGINS ?? '').split(','),
    app_url: process.env.APP_URL,
  },
  database: { url: process.env.DATABASE_URL },
  redis: redisConfig(),
  auth: {
    jwt_secret: process.env.JWT_SECRET,
    review_email: process.env.REVIEW_EMAIL?.trim().toLowerCase() || undefined,
    review_code: process.env.REVIEW_CODE?.trim() || undefined,
  },
  email: {
    resend_api_key: process.env.RESEND_API_KEY,
    from: process.env.FROM_EMAIL || 'Christ Link Social <no-reply@christlinksocial.com>',
  },
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    connect_webhook_secret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  },
  r2: {
    account_id: process.env.R2_ACCOUNT_ID,
    access_key_id: process.env.R2_ACCESS_KEY_ID,
    secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    public_url: process.env.R2_PUBLIC_URL?.replace(/\/+$/, ''),
  },
  expo: { access_token: process.env.EXPO_ACCESS_TOKEN },
  apple_wallet: {
    team_id: process.env.APPLE_TEAM_ID,
    pass_type_id: process.env.APPLE_PASS_TYPE_ID,
    p12_base64: process.env.APPLE_PASS_P12_BASE64,
    password: process.env.APPLE_PASS_PASSWORD,
  },
  sentry: { dsn: process.env.SENTRY_DSN },
});

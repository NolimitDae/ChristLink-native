function redisConfig() {
  // Railway's Redis service exposes REDIS_URL and REDISHOST/REDISPORT/REDISPASSWORD
  const url = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;
  return {
    host: process.env.REDISHOST || url?.hostname || '127.0.0.1',
    port: Number(process.env.REDISPORT || url?.port || 6379),
    username: process.env.REDISUSER || (url?.username ? decodeURIComponent(url.username) : undefined),
    password: process.env.REDISPASSWORD || (url?.password ? decodeURIComponent(url.password) : ''),
    // 0 = IPv4 or IPv6; Railway private networking (*.railway.internal) is IPv6-only
    family: 0,
  };
}

export default () => ({
  app: {
    name: process.env.APP_NAME || 'ChristLink',
    client_app_url: process.env.CLIENT_APP_URL,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: redisConfig(),
});

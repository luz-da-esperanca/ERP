export function integrationEnvironment() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const redisUrl = process.env.TEST_REDIS_URL;
  if (!databaseUrl || !redisUrl)
    throw new Error(
      'Integration tests require TEST_DATABASE_URL and TEST_REDIS_URL',
    );
  if (!new URL(databaseUrl).pathname.endsWith('_test'))
    throw new Error('Integration database name must end in _test');
  return { databaseUrl, redisUrl };
}

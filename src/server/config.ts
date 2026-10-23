export function readConfig(environment: NodeJS.ProcessEnv) {
  const databaseUrl = environment.DATABASE_URL ?? '';
  if (!isPostgreSqlUrl(databaseUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  }
  const portText = environment.PORT ?? '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return {
    databaseUrl,
    host: environment.HOST ?? '127.0.0.1',
    port,
  };
}

function isPostgreSqlUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && url.hostname.length > 0 && url.pathname.length > 1;
  } catch {
    return false;
  }
}

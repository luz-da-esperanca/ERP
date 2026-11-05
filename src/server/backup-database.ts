import { runDatabaseBackup } from './backup.ts';
import { readConfig } from './config.ts';

try {
  const config = readConfig(process.env);
  const directory = process.env.BACKUP_DIRECTORY ?? 'backups';
  const { file } = await runDatabaseBackup({ databaseUrl: config.databaseUrl, directory });
  console.log(`Database backup written to ${file}`);
} catch {
  console.error('Database backup failed. Verify DATABASE_URL, BACKUP_DIRECTORY, and pg_dump availability.');
  process.exitCode = 1;
}

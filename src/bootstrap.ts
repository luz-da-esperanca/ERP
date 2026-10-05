import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { createUserSchema } from '@erp/contracts/access-api';
import { readConfig } from './core/config.js';
import { createDatabase } from './core/database.js';
import { PrismaAccounts } from './features/access/infra/prisma-accounts.js';
import { createPasswordHasher } from './features/access/infra/bcrypt-passwords.js';
import { assertDataMode } from './app.js';

async function hiddenPassword() {
  if (!stdin.isTTY)
    throw new Error('Bootstrap requires an interactive terminal');
  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) stdout.write(chunk);
      callback();
    },
  });
  const prompt = createInterface({ input: stdin, output, terminal: true });
  stdout.write('Initial password: ');
  muted = true;
  try {
    return await prompt.question('');
  } finally {
    prompt.close();
    stdout.write('\n');
  }
}
const config = readConfig(process.env);
const database = createDatabase(config.DATABASE_URL);
try {
  await assertDataMode(database, config);
  const prompt = createInterface({ input: stdin, output: stdout });
  const login = await prompt.question('Administrator login: ');
  const displayName = await prompt.question('Display name: ');
  prompt.close();
  const input = createUserSchema.parse({
    login,
    displayName,
    initialPassword: await hiddenPassword(),
    roleCodes: ['ADMINISTRATOR'],
  });
  const passwords = await createPasswordHasher(config.BCRYPT_COST);
  const account = await new PrismaAccounts(database, config).bootstrap(
    input,
    await passwords.hash(input.initialPassword),
  );
  console.log(
    `Administrator created: ${account.id}. Change the initial password after login.`,
  );
} catch {
  console.error(
    'Bootstrap failed; check input, configuration and existing accounts',
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}

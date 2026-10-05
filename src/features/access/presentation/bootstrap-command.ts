import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { Writable } from 'node:stream';
import { createUserSchema } from '@erp/contracts/access-api';
import type { AccountsStore, PasswordHasher } from '../application/ports.js';

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

export async function runBootstrap(
  accounts: AccountsStore,
  passwords: PasswordHasher,
) {
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
  const account = await accounts.bootstrap(
    input,
    await passwords.hash(input.initialPassword),
  );
  console.log(
    `Administrator created: ${account.id}. Change the initial password after login.`,
  );
}

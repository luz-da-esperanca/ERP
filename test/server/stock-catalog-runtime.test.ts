import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

it('loads the catalog in the native Node TypeScript runtime and enforces HTTP authorization', async () => {
  const result = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', `
    import { createApp } from './src/server/app.ts';
    import { Quantity } from './src/modules/social-stock/domain/quantity.ts';
    const app = createApp({ checkDatabase: async () => {} });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/v1/stock-items' });
      if (response.statusCode !== 401) throw new Error('Catalog authorization was bypassed.');
      const unit = { id: 'synthetic-unit', precision: 3 };
      const sum = Quantity.parse('0.1', unit).add(Quantity.parse('0.2', unit)).toString();
      if (sum !== '0.300') throw new Error('Exact quantity arithmetic failed.');
      console.log('Native catalog runtime verified.');
    } finally { await app.close(); }
  `]);
  expect(result.stdout).toContain('Native catalog runtime verified.');
});

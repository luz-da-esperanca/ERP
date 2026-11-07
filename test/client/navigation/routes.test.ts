import { describe, expect, it } from 'vitest';
import { matchRoute } from '../../../src/client/navigation/routes.ts';

describe('matchRoute', () => {
  it('matches the configured hub destination', () => {
    expect(matchRoute('/hub', '/hub')).toEqual({ name: 'hub' });
    expect(matchRoute('/projects', '/projects')).toEqual({ name: 'hub' });
  });

  it('matches the stock screens independently of the hub destination', () => {
    expect(matchRoute('/stock/catalog', '/hub')).toEqual({ name: 'stock-catalog' });
    expect(matchRoute('/stock/origins', '/hub')).toEqual({ name: 'stock-origins' });
    expect(matchRoute('/stock/catalog', '/projects')).toEqual({ name: 'stock-catalog' });
  });

  it('returns null for public and unknown paths', () => {
    expect(matchRoute('/login', '/hub')).toBeNull();
    expect(matchRoute('/access-denied', '/hub')).toBeNull();
    expect(matchRoute('/projects', '/hub')).toBeNull();
    expect(matchRoute('/stock/catalog/items', '/hub')).toBeNull();
  });
});

import { act } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, onTestFinished } from 'vitest';
import { App } from '../../../src/client/app.tsx';
import { createHttpAuthService, type FetchClient } from '../../../src/client/auth/http-auth-service.ts';
import { createApp } from '../../../src/server/app.ts';

const credentials = { loginIdentifier: 'logout@example.invalid', password: 'SyntheticPassword!123' };
const hubRoute = { destination: '/hub', requiredProfile: 'COORDINATOR' as const };

function createBrowser() {
  const server = createApp({ checkDatabase: async () => {}, seedUsers: [{
    id: '01963000-0000-7000-8000-000000000001', ...credentials,
    displayName: 'Synthetic Coordinator', profiles: ['COORDINATOR'],
  }] });
  onTestFinished(() => server.close());
  let cookie = '';
  let isLogoutUnavailable = true;
  let logoutCount = 0;
  const fetchClient: FetchClient = async (url, init) => {
    if (url === '/api/v1/auth/logout') {
      logoutCount += 1;
      if (isLogoutUnavailable) throw new Error('Synthetic connection failure.');
    }
    const headers = new Headers(init.headers);
    headers.set('host', '127.0.0.1:5173');
    if (init.method === 'POST') headers.set('origin', 'http://127.0.0.1:5173');
    if (cookie) headers.set('cookie', cookie);
    const response = await server.inject({ method: init.method === 'POST' ? 'POST' : 'GET', url,
      headers: Object.fromEntries(headers), ...(typeof init.body === 'string' ? { payload: init.body } : {}) });
    if (typeof response.headers['set-cookie'] === 'string') cookie = response.headers['set-cookie'].split(';')[0] ?? '';
    return new Response(response.body || null, { status: response.statusCode });
  };
  return { fetchClient, allowLogout: () => { isLogoutUnavailable = false; },
    getLogoutCount: () => logoutCount,
    serverSession: () => server.inject({ method: 'GET', url: '/api/v1/auth/session', headers: { cookie } }) };
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/login');
});

it('keeps protected content hidden after failed logout and Back navigation until revocation is retried', async () => {
  const browser = createBrowser();
  const authService = createHttpAuthService({ fetchClient: browser.fetchClient });
  expect((await authService.signIn(credentials)).status).toBe('authenticated');
  window.history.replaceState({}, '', '/hub');
  render(<App authService={authService} hubRoute={hubRoute} />);
  expect(await screen.findByRole('heading', { name: 'Área inicial' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByLabelText('Senha')).toBeNull();
  expect((await browser.serverSession()).statusCode).toBe(200);
  await act(async () => {
    window.history.replaceState({}, '', '/hub');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  expect(screen.queryByText('Synthetic Coordinator')).toBeNull();
  expect(screen.getByRole('button', { name: 'Tentar sair novamente' })).toBeTruthy();

  browser.allowLogout();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar sair novamente' }));
  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect((await browser.serverSession()).statusCode).toBe(401);
  expect(window.sessionStorage.length).toBe(0);
});

it('retains only a non-secret logout intent across reload and can revoke the session with a fresh adapter', async () => {
  const browser = createBrowser();
  const authService = createHttpAuthService({ fetchClient: browser.fetchClient });
  await authService.signIn(credentials);
  await expect(authService.signOut()).rejects.toThrow();
  expect(window.sessionStorage.length).toBe(1);
  expect(window.sessionStorage.getItem(window.sessionStorage.key(0) ?? '')).toBe('pending');

  const reloadedService = createHttpAuthService({ fetchClient: browser.fetchClient });
  await expect(reloadedService.getSession()).rejects.toThrow();
  expect((await reloadedService.signIn(credentials)).status).toBe('unavailable');
  window.history.replaceState({}, '', '/hub');
  render(<App authService={reloadedService} hubRoute={hubRoute} />);
  expect(screen.queryByRole('heading', { name: 'Área inicial' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Tentar sair novamente' })).toBeTruthy();

  browser.allowLogout();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar sair novamente' }));
  expect(await screen.findByRole('heading', { name: 'Acessar sistema' })).toBeTruthy();
  expect((await browser.serverSession()).statusCode).toBe(401);
  expect(window.sessionStorage.length).toBe(0);
});

it('coalesces concurrent logout retries instead of racing a new login against cookie removal', async () => {
  const browser = createBrowser();
  const authService = createHttpAuthService({ fetchClient: browser.fetchClient });
  await authService.signIn(credentials);
  browser.allowLogout();
  const first = authService.signOut();
  const second = authService.signOut();
  expect((await authService.signIn(credentials)).status).toBe('unavailable');
  await Promise.all([first, second]);
  expect(browser.getLogoutCount()).toBe(1);
  expect((await browser.serverSession()).statusCode).toBe(401);
  expect((await authService.signIn(credentials)).status).toBe('authenticated');
});

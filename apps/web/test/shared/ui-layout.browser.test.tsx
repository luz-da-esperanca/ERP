import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { capabilitySchema } from '@erp/contracts/access';
import tailwindcss from '@tailwindcss/vite';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Field, Page, Panel, SelectField, Submit } from '../../src/shared/ui';
import { AppShell } from '../../src/app/app-layout';
import { HttpProjects, ProjectForm } from '../../src/projects';
import { ConnectedApp } from '../../src/app/connected-app';
import { ApiClient } from '../../src/shared/api-client';
import { HttpErpClient } from '../../src/app/http-erp-client';
import { ConnectedDashboardPage } from '../../src/home';

const execute = promisify(execFile);
const browserBinary = process.env.AGENT_BROWSER_BIN;
const session = `erp-layout-${process.pid}`;

describe.skipIf(!browserBinary)('Rendered shared control layout', () => {
  let server: ViteDevServer;
  let baseUrl: string;

  async function browser(...args: string[]) {
    const result = await execute(
      browserBinary!,
      ['--session', session, ...args],
      {
        encoding: 'utf8',
        timeout: 30_000,
      },
    );
    return result.stdout;
  }

  async function evaluate<T>(source: string): Promise<T> {
    const response = JSON.parse(await browser('eval', '--json', source));
    if (!response.success) throw new Error(response.error);
    return response.data.result as T;
  }

  beforeAll(async () => {
    const content = renderToStaticMarkup(
      <main className="page-wrap">
        <section className="panel">
          <form className="form-stack">
            <div className="form-grid">
              <Field label="Nome completo" name="name" required />
              <SelectField label="Instituto" name="institute" required>
                <option value="">Selecione</option>
              </SelectField>
              <Field
                label="É titular da família"
                name="isReference"
                type="checkbox"
              />
              <Field
                label="Conferi os candidatos"
                name="confirmed"
                type="checkbox"
                required
              />
            </div>
            <Submit pending={false}>Cadastrar pessoa</Submit>
            <button className="button secondary" type="button">
              Cancelar
            </button>
          </form>
        </section>
        <div className="table-wrap">
          <table className="min-w-0">
            <tbody>
              <tr>
                <td>Dados sintéticos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>,
    );
    const shell = renderToStaticMarkup(
      <MemoryRouter>
        <AppShell
          displayName="Conta sintética de coordenação"
          roles={['ADMINISTRATOR', 'COORDINATION']}
          capabilities={capabilitySchema.options}
          showManagement
          onLogout={() => {}}
          onSearch={() => {}}
          accountLabel="Dados sintéticos"
        >
          <h1>Teste de navegação</h1>
        </AppShell>
      </MemoryRouter>,
    );
    const dashboard = renderToStaticMarkup(
      <MemoryRouter>
        <AppShell
          displayName="Maria Clara"
          roles={['ADMINISTRATOR', 'COORDINATION']}
          capabilities={capabilitySchema.options}
          showManagement
          onLogout={() => {}}
          accountLabel="Dados sintéticos"
        >
          <ConnectedDashboardPage
            client={new HttpErpClient(new ApiClient())}
            capabilities={capabilitySchema.options}
            displayName="Maria Clara"
          />
        </AppShell>
      </MemoryRouter>,
    );
    const management = renderToStaticMarkup(
      <main className="page-wrap">
        <section className="panel">
          <ProjectForm
            gateway={new HttpProjects(new ApiClient())}
            overview={{
              projects: [],
              activities: [],
              serviceTypes: [],
              institutes: [],
            }}
            onCompleted={() => {}}
            onCancel={() => {}}
          />
        </section>
      </main>,
    );
    const anonymousState = { status: 'anonymous', session: null } as const;
    const login = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/login']}>
        <ConnectedApp
          authentication={{
            getSnapshot: () => anonymousState,
            subscribe: () => () => {},
            restore: async () => {},
            login: async () => {},
            logout: async () => {},
            changePassword: async () => {},
          }}
        />
      </MemoryRouter>,
    );
    const sections = renderToStaticMarkup(
      <main className="page-wrap">
        <Page title="Consulta de registros">
          <Panel title="Filtros">
            <Field label="Buscar registros" name="query" />
          </Panel>
          <Panel title="Resultados">
            <p>Dados sintéticos</p>
          </Panel>
        </Page>
      </main>,
    );
    server = await createServer({
      configFile: false,
      root: fileURLToPath(new URL('../../', import.meta.url)),
      plugins: [
        tailwindcss(),
        {
          name: 'layout-fixture',
          configureServer(server) {
            server.middlewares.use('/__layout-test', (request, response) => {
              response.setHeader('Content-Type', 'text/html');
              const fixtures: Record<string, string> = {
                '/sidebar': shell,
                '/dashboard': dashboard,
                '/management': management,
                '/login': login,
                '/sections': sections,
              };
              const fixture = fixtures[request.url ?? ''] ?? content;
              response.end(
                `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css?direct"></head><body>${fixture}</body></html>`,
              );
            });
          },
        },
      ],
      server: { host: '127.0.0.1', port: 0 },
    });
    await server.listen();
    baseUrl = `${server.resolvedUrls!.local[0]}__layout-test`;
    await browser('set', 'viewport', '1440', '1000');
    await browser('open', baseUrl);
    await browser(
      'wait',
      '--fn',
      "getComputedStyle(document.querySelector('.form-stack')).display === 'grid'",
    );
  }, 30_000);

  afterAll(async () => {
    try {
      await browser('close');
    } finally {
      await server?.close();
    }
  });

  it('keeps optional and required checkboxes compact beside their labels', async () => {
    const controls = await evaluate<
      { width: number; height: number; labelHeight: number }[]
    >(`
      [...document.querySelectorAll('input[type="checkbox"]')].map(input => ({
        width: input.getBoundingClientRect().width,
        height: input.getBoundingClientRect().height,
        labelHeight: input.closest('label').getBoundingClientRect().height
      }))
    `);
    expect(controls).toHaveLength(2);
    for (const control of controls) {
      expect(control.width).toBeLessThanOrEqual(24);
      expect(control.height).toBeLessThanOrEqual(24);
      expect(control.labelHeight).toBeLessThanOrEqual(48);
    }
  });

  it('sizes form actions to their content instead of stretching across the grid', async () => {
    const buttons = await evaluate<{ width: number; height: number }[]>(`
      [...document.querySelectorAll('.form-stack > .button')].map(button => ({
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height
      }))
    `);
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.width).toBeLessThan(240);
      expect(button.height).toBe(40);
    }
  });

  it('allows Tailwind utilities to override the shared table minimum width', async () => {
    await browser('set', 'viewport', '390', '844');
    const table = await evaluate<{
      minimum: string;
      width: number;
      container: number;
    }>(`
      (() => {
        const table = document.querySelector('table');
        return {
          minimum: getComputedStyle(table).minWidth,
          width: table.getBoundingClientRect().width,
          container: table.parentElement.getBoundingClientRect().width
        };
      })()
    `);
    expect(table.minimum).toBe('0px');
    expect(table.width).toBeLessThanOrEqual(table.container);
  });

  it('keeps logout visible when all authorized navigation entries fill a short viewport', async () => {
    await browser('set', 'viewport', '1280', '600');
    await browser('open', `${baseUrl}/sidebar`);
    const layout = await evaluate<{
      footerBottom: number;
      height: number;
      overflow: string;
    }>(`
      ({
        footerBottom: document.querySelector('.sidebar-bottom').getBoundingClientRect().bottom,
        height: innerHeight,
        overflow: getComputedStyle(document.querySelector('.sidebar nav')).overflowY
      })
    `);
    expect(layout.footerBottom).toBeLessThanOrEqual(layout.height);
    expect(layout.overflow).toBe('auto');
  });

  it('hides the closed mobile navigation and preserves the menu touch target', async () => {
    await browser('set', 'viewport', '390', '844');
    const layout = await evaluate<{
      visibility: string;
      buttonWidth: number;
      overflow: boolean;
    }>(`
      ({
        visibility: getComputedStyle(document.querySelector('.sidebar')).visibility,
        buttonWidth: document.querySelector('.mobile-menu').getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth
      })
    `);
    expect(layout.visibility).toBe('hidden');
    expect(layout.buttonWidth).toBeGreaterThanOrEqual(40);
    expect(layout.overflow).toBe(false);
  });

  it('constrains linear forms and places save and cancel together', async () => {
    await browser('set', 'viewport', '1440', '1000');
    await browser('open', `${baseUrl}/management`);
    const layout = await evaluate<{ width: number; buttonTops: number[] }>(`
      ({
        width: document.querySelector('form').getBoundingClientRect().width,
        buttonTops: [...document.querySelectorAll('form button')].map(button => button.getBoundingClientRect().top)
      })
    `);
    expect(layout.width).toBeLessThanOrEqual(800);
    expect(layout.buttonTops).toHaveLength(2);
    expect(layout.buttonTops[0]).toBe(layout.buttonTops[1]);
  });

  it('keeps login captions on one line and the sign-in action at full width', async () => {
    await browser('open', `${baseUrl}/login`);
    const layout = await evaluate<{
      heights: number[];
      buttonWidth: number;
      inputWidth: number;
    }>(`
      ({
        heights: [...document.querySelectorAll('.field')].map(field => field.getBoundingClientRect().height),
        buttonWidth: document.querySelector('button[type="submit"]').getBoundingClientRect().width,
        inputWidth: document.querySelector('input').getBoundingClientRect().width
      })
    `);
    expect(layout.heights).toHaveLength(2);
    for (const height of layout.heights) expect(height).toBeLessThan(80);
    expect(layout.buttonWidth).toBe(layout.inputWidth);
  });

  it('separates consecutive work sections instead of joining their borders', async () => {
    await browser('open', `${baseUrl}/sections`);
    const gap = await evaluate<number>(`
      (() => {
        const panels = document.querySelectorAll('.panel');
        return panels[1].getBoundingClientRect().top - panels[0].getBoundingClientRect().bottom;
      })()
    `);
    expect(gap).toBeGreaterThanOrEqual(24);
  });

  it('matches the dashboard panel proportions and compact work rows from the prototype', async () => {
    await browser('set', 'viewport', '1440', '1000');
    await browser('open', `${baseUrl}/dashboard`);
    const layout = await evaluate<{
      panelTops: number[];
      panelWidths: number[];
      panelHeights: number[];
      rowLayout: string;
      rowPadding: string;
      sectionGap: number;
    }>(`
      (() => {
        const panels = [...document.querySelectorAll('.dashboard-grid > .panel')].map(panel => panel.getBoundingClientRect());
        const row = getComputedStyle(document.querySelector('.dashboard-task'));
        return {
          panelTops: panels.map(panel => panel.top),
          panelWidths: panels.map(panel => panel.width),
          panelHeights: panels.map(panel => panel.height),
          rowLayout: row.display,
          rowPadding: row.paddingTop,
          sectionGap: panels[0].top - document.querySelector('.quick-actions').getBoundingClientRect().bottom
        };
      })()
    `);
    expect(layout.panelTops[0]).toBe(layout.panelTops[1]);
    expect(layout.panelWidths[0]).toBeGreaterThan(layout.panelWidths[1] * 2);
    expect(layout.panelHeights[1]).toBeLessThan(layout.panelHeights[0]);
    expect(layout.rowLayout).toBe('flex');
    expect(layout.rowPadding).toBe('16px');
    expect(layout.sectionGap).toBe(24);
  });

  it('stacks dashboard work actions on mobile without horizontal overflow', async () => {
    await browser('set', 'viewport', '390', '844');
    await browser('open', `${baseUrl}/dashboard`);
    const layout = await evaluate<{
      direction: string;
      contentWidth: number;
      viewportWidth: number;
      panelTops: number[];
    }>(`
      ({
        direction: getComputedStyle(document.querySelector('.dashboard-task')).flexDirection,
        contentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        panelTops: [...document.querySelectorAll('.dashboard-grid > .panel')].map(panel => panel.getBoundingClientRect().top)
      })
    `);
    expect(layout.direction).toBe('column');
    expect(layout.contentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.panelTops[1]).toBeGreaterThan(layout.panelTops[0]);
  });
});

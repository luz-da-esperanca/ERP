// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@erp/contracts/audit';
import { ErpProvider } from '../../../../src/app/erp-provider';
import { createDemoClient } from '../../../../src/demo/create-demo-client';
import { FamilyPage } from '../../../../src/registration';

describe('FamilyPage', () => {
  it('shows only authorized audit events for the selected family', async () => {
    const client = createDemoClient();
    const socialAccount = client.access
      .demoAccounts()
      .find((account) => account.roles.includes('SOCIAL_ASSISTANCE'));

    if (!socialAccount)
      throw new Error('Social assistance account was not found');

    client.access.enterDemo(socialAccount.id);
    const [family] = await client.registration.listFamilies();

    if (!family) throw new Error('Demo family was not found');

    const familyEvent: AuditEntry = {
      id: 'family-audit-entry',
      entityId: family.id,
      entityLabel: family.referenceName ?? `Família ${family.code}`,
      action: 'UPDATE',
      actorId: socialAccount.id,
      actorName: socialAccount.displayName,
      recordedAt: '2026-10-05T13:00:00.000-03:00',
      occurredAt: '2026-10-05T12:00:00.000-03:00',
      reason: 'Address correction',
      readCapability: 'registration.read',
      before: null,
      after: {},
    };
    const unrelatedEvent: AuditEntry = {
      ...familyEvent,
      id: 'unrelated-audit-entry',
      entityId: 'another-family',
      entityLabel: 'Família não selecionada',
      action: 'CREATE',
    };
    client.audit.list = async () => [unrelatedEvent, familyEvent];

    render(
      <ErpProvider client={client}>
        <MemoryRouter initialEntries={[`/families/${family.id}`]}>
          <Routes>
            <Route path="families/:id" element={<FamilyPage />} />
          </Routes>
        </MemoryRouter>
      </ErpProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Histórico de alterações' }),
    ).toBeTruthy();
    expect(screen.getByText(/Cadastro atualizado/)).toBeTruthy();
    expect(screen.getByText('Motivo: Address correction')).toBeTruthy();
    expect(screen.queryByText('Família não selecionada')).toBeNull();
  });
});

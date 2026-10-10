import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { FamilyInput } from '@erp/contracts/registration';
import { Field } from '../../../shared/ui';
import { MaskedField } from '../../../shared/masked-field';
import { lookupPostalAddress } from '../infra/lookup-postal-address';

export function AddressFields({
  initial,
  required = false,
  lookup = lookupPostalAddress,
}: {
  initial?: Partial<FamilyInput>;
  required?: boolean;
  lookup?: typeof lookupPostalAddress;
}) {
  const [address, setAddress] = useState(initial?.address ?? '');
  const [neighborhood, setNeighborhood] = useState(initial?.neighborhood ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const lastPostalCode = useRef<string | null>(null);
  const statusId = useId();
  useEffect(() => () => pending.current?.abort(), []);

  function onPostalInput(event: FormEvent<HTMLInputElement>) {
    const postalCode = event.currentTarget.value.replace(/\D/g, '');
    if (lastPostalCode.current === postalCode) return;
    lastPostalCode.current = postalCode;
    pending.current?.abort();
    setMessage(null);
    if (postalCode.length !== 8) return;
    const controller = new AbortController();
    pending.current = controller;
    const previousAddress = address;
    const previousNeighborhood = neighborhood;
    setMessage('Consultando CEP…');
    void lookup(postalCode, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result) {
          setMessage(
            'CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.',
          );
          return;
        }
        if (result.street)
          setAddress((current) =>
            current === previousAddress
              ? `${result.street}, ${result.city} - ${result.state}`
              : current,
          );
        if (result.neighborhood)
          setNeighborhood((current) =>
            current === previousNeighborhood ? result.neighborhood : current,
          );
        setMessage(
          result.street
            ? 'Endereço localizado. Confira os dados e acrescente o número e o complemento.'
            : 'CEP localizado sem logradouro. Preencha o endereço e o bairro manualmente.',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            'Não foi possível consultar o CEP. Preencha o endereço manualmente.',
          );
      });
  }

  return (
    <>
      <div className="field">
        <MaskedField
          mask="postalCode"
          label="CEP"
          name="postalCode"
          required={required}
          defaultValue={initial?.postalCode ?? ''}
          onInput={onPostalInput}
          aria-describedby={message ? statusId : undefined}
        />
        {message && (
          <p className="muted" role="status" id={statusId}>
            {message}
          </p>
        )}
      </div>
      <Field
        label="Endereço"
        name="address"
        required={required}
        maxLength={500}
        autoComplete="street-address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
      <Field
        label="Bairro"
        name="neighborhood"
        required={required}
        maxLength={200}
        value={neighborhood}
        onChange={(event) => setNeighborhood(event.target.value)}
      />
    </>
  );
}

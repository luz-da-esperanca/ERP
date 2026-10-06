import { useCallback, useState } from 'react';
import type { FamilyDto } from '@erp/contracts/registration-api';
import type { HttpRegistration } from '../infra/http-registration';
import { useApiQuery } from '../../../shared/use-query';
import { AsyncView, Field, SelectField } from '../../../shared/ui';
export function FamilyLookup({
  registration,
  onSelect,
  required = true,
}: {
  registration: HttpRegistration;
  required?: boolean;
  onSelect: (family: FamilyDto | null) => void;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const load = useCallback(
    () => (query ? registration.listFamilies(query) : Promise.resolve([])),
    [registration, query],
  );
  const state = useApiQuery(load);
  const select = useCallback(
    () => (selected ? registration.getFamily(selected) : Promise.resolve(null)),
    [registration, selected],
  );
  const detail = useApiQuery(select);
  return (
    <div className="form-stack">
      <Field
        label="Buscar família de destino por nome ou código"
        name="familySearch"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={200}
      />
      <button
        type="button"
        className="button secondary"
        disabled={text.trim().length < 2 && !/^[1-9]\d*$/.test(text.trim())}
        onClick={() => {
          setQuery(text.trim());
          setSelected('');
          onSelect(null);
        }}
      >
        Buscar família de destino
      </button>
      <AsyncView state={state}>
        {(families) => (
          <SelectField
            label="Família de destino"
            name="targetFamilyId"
            required={required}
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              onSelect(null);
            }}
          >
            <option value="">Selecione</option>
            {families.map((family) => (
              <option key={family.id} value={family.id}>
                {family.referenceName ?? 'Família'} · Código {family.code}
              </option>
            ))}
          </SelectField>
        )}
      </AsyncView>
      <AsyncView state={detail}>
        {(value) =>
          value && (
            <div>
              <p>
                Destino: {value.family.referenceName ?? value.family.code} ·
                Revisão {value.family.revision} · {value.family.memberCount}{' '}
                membros.
              </p>
              <button
                type="button"
                className="button secondary"
                onClick={() => onSelect(value.family)}
              >
                Confirmar família de destino
              </button>
            </div>
          )
        }
      </AsyncView>
    </div>
  );
}

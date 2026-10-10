import { useEffect, useId, useRef, useState } from 'react';
import type { HttpProjects } from '../infra/http-projects';
import { errorMessage } from '../../../shared/use-action';

type Person = Awaited<ReturnType<HttpProjects['people']>>[number];
type Lookup =
  { term: string; people: Person[] } | { term: string; error: unknown };

const minimumLength = 2;
const debounceMs = 250;

function describe(person: Person) {
  if ('family' in person && person.family)
    return ` · Família ${person.family.code}`;
  if ('birthDate' in person && person.birthDate)
    return ` · Nascimento ${person.birthDate.split('-').reverse().join('/')}`;
  return '';
}

/**
 * Type-ahead person picker. The chosen id travels in a hidden `personId`
 * input so surrounding forms keep reading it from their FormData.
 */
export function PersonSelection({
  gateway,
  label = 'Participante',
}: {
  gateway: HttpProjects;
  label?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const term = text.trim();

  useEffect(() => {
    if (selected || term.length < minimumLength) return;
    let current = true;
    // Debounce so a fast typist triggers one request for the final text.
    const timer = setTimeout(() => {
      gateway.people(term).then(
        (people) => current && setLookup({ term, people }),
        (error: unknown) => current && setLookup({ term, error }),
      );
    }, debounceMs);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [gateway, term, selected]);

  // Native validation cannot see the hidden input, so the visible one
  // refuses submission until a person is actually chosen from the list.
  useEffect(() => {
    input.current?.setCustomValidity(
      selected ? '' : 'Selecione uma pessoa da lista.',
    );
  }, [selected]);

  const result = lookup?.term === term ? lookup : null;
  const people = result && 'people' in result ? result.people : [];
  const showList = open && !selected && term.length >= minimumLength;

  function choose(person: Person) {
    setSelected(person);
    setText(person.name);
    setOpen(false);
    setHighlighted(-1);
  }

  return (
    <div className="field combobox">
      <label htmlFor={id}>
        {label}
        <span aria-hidden="true"> *</span>
      </label>
      <input
        ref={input}
        id={id}
        name="personSearch"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && highlighted >= 0 ? `${id}-${highlighted}` : undefined
        }
        autoComplete="off"
        autoFocus
        required
        maxLength={200}
        placeholder="Digite ao menos 2 letras do nome"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setSelected(null);
          setOpen(true);
          setHighlighted(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (!showList) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlighted((value) => Math.min(value + 1, people.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlighted((value) => Math.max(value - 1, 0));
          } else if (event.key === 'Enter') {
            // Never submit the surrounding form while the list is open.
            event.preventDefault();
            const person = people[highlighted];
            if (person) choose(person);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      <input type="hidden" name="personId" value={selected?.id ?? ''} />
      {showList && (
        <ul id={`${id}-list`} role="listbox" className="combobox-list">
          {!result && (
            <li className="combobox-status" role="status">
              Buscando…
            </li>
          )}
          {result && 'error' in result && (
            <li className="combobox-status" role="alert">
              {errorMessage(result.error)}
            </li>
          )}
          {result && 'people' in result && !people.length && (
            <li className="combobox-status">Nenhuma pessoa encontrada.</li>
          )}
          {people.map((person, index) => (
            <li
              key={person.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              className="combobox-option"
              // Keeps focus in the input so blur does not close the list first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(person)}
            >
              {person.name}
              {describe(person)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

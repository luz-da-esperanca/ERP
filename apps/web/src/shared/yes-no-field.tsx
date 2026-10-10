import { Field } from './ui';

export function YesNoField({
  label,
  name,
  required = true,
  defaultValue,
  onChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: boolean | null;
  onChange?: (value: boolean) => void;
}) {
  return (
    <fieldset className="field">
      <legend>{label}</legend>
      <div className="form-grid">
        <Field
          label="Sim"
          name={name}
          type="radio"
          value="true"
          required={required}
          defaultChecked={defaultValue === true}
          onChange={() => onChange?.(true)}
        />
        <Field
          label="Não"
          name={name}
          type="radio"
          value="false"
          required={required}
          defaultChecked={defaultValue === false}
          onChange={() => onChange?.(false)}
        />
      </div>
    </fieldset>
  );
}

import type { OptionField, ToolOptions } from "../types";

type ToolOptionsFormProps = {
  fields: OptionField[];
  options: ToolOptions;
  onChange: (options: ToolOptions) => void;
};

export function ToolOptionsForm({ fields, options, onChange }: ToolOptionsFormProps) {
  const visibleFields = fields.filter((field) => !field.showWhen || field.showWhen(options));

  if (visibleFields.length === 0) {
    return <p className="quiet-copy">This tool is ready with the files you selected.</p>;
  }

  return (
    <div className="options-grid">
      {visibleFields.map((field) => (
        <label className={`field field-${field.type}`} key={field.name}>
          <span>{field.label}</span>
          {renderField(field, options[field.name], (value) => onChange({ ...options, [field.name]: value }))}
          {field.help && <small>{field.help}</small>}
        </label>
      ))}
    </div>
  );
}

function renderField(field: OptionField, value: unknown, onChange: (value: string | number | boolean) => void) {
  if (field.type === "select") {
    return (
      <select value={String(value ?? field.defaultValue)} onChange={(event) => onChange(event.currentTarget.value)}>
        {field.choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={String(value ?? field.defaultValue)}
        placeholder={field.placeholder}
        rows={3}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <input
        checked={Boolean(value ?? field.defaultValue)}
        type="checkbox"
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    );
  }

  if (field.type === "number" || field.type === "range") {
    return (
      <span className={field.type === "range" ? "range-row" : undefined}>
        <input
          value={Number(value ?? field.defaultValue)}
          type={field.type}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        />
        {field.type === "range" && <output>{Number(value ?? field.defaultValue).toFixed(field.step && field.step < 0.1 ? 2 : 1)}</output>}
      </span>
    );
  }

  return (
    <input
      value={String(value ?? field.defaultValue)}
      type={field.type}
      placeholder={"placeholder" in field ? field.placeholder : undefined}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

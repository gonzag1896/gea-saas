import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string | null;
  children: ReactElement<{ id?: string }>;
  className?: string;
}

// Envuelve un control (Input/Select/Textarea) con su label y su mensaje de
// error, generando el `id`/`htmlFor` para que queden asociados sin que
// cada pantalla tenga que inventarlo.
export function FormField({ label, error, children, className }: FormFieldProps) {
  const generatedId = useId();
  const id = isValidElement(children) && children.props.id ? children.props.id : generatedId;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      {cloneElement(children, { id })}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string | null;
  required?: boolean;
  children: ReactElement<{ id?: string; error?: boolean }>;
  className?: string;
}

// Envuelve un control (Input/Select/Textarea) con su label y su mensaje de
// error, generando el `id`/`htmlFor` para que queden asociados y
// propagando `error` al control para que se dibuje con borde rojo — sin
// que cada pantalla tenga que coordinar las dos cosas a mano.
export function FormField({ label, error, required, children, className }: FormFieldProps) {
  const generatedId = useId();
  const id = isValidElement(children) && children.props.id ? children.props.id : generatedId;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {cloneElement(children, { id, error: !!error })}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}

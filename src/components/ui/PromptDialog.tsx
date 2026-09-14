"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";
import { FormField } from "./FormField";

interface PromptDialogProps {
  open: boolean;
  title: string;
  label: string;
  type?: "text" | "number";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  confirmLabel?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

// Reemplaza window.prompt() en los puntos donde hoy se pide un dato de
// texto/número junto con la confirmación de la acción (motivo de
// anulación/devolución, cantidad a devolver, nuevo precio, etc.).
export function PromptDialog({
  open,
  title,
  label,
  type = "text",
  placeholder,
  defaultValue = "",
  required = true,
  confirmLabel = "Confirmar",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (required && !value.trim()) return;
    onConfirm(value);
  }

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <FormField label={label} error={error}>
          <Input
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            required={required}
            autoFocus
          />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

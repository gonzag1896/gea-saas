"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button, type ButtonVariant } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Extract<ButtonVariant, "primary" | "danger">;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmación sí/no sobre Modal — reemplaza los puntos donde hoy
// window.prompt() se usaba solo como gate de confirmación (cancelar el
// prompt = abortar la acción).
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message}
    </Modal>
  );
}

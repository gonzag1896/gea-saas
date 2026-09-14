"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";

interface DevolucionDialogProps {
  open: boolean;
  onConfirm: (cantidad: number, motivo: string | undefined) => void;
  onCancel: () => void;
}

// Compras y Ventas piden exactamente lo mismo para una devolución parcial
// de línea (cantidad + motivo opcional) — antes eran dos window.prompt()
// seguidos en cada una de las dos pantallas.
export function DevolucionDialog({ open, onConfirm, onCancel }: DevolucionDialogProps) {
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!cantidad) return;
    onConfirm(Number(cantidad), motivo || undefined);
    setCantidad("");
    setMotivo("");
  }

  return (
    <Modal open={open} onClose={onCancel} title="Registrar devolución">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <FormField label="Cantidad a devolver">
          <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} required autoFocus />
        </FormField>
        <FormField label="Motivo (opcional)">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">Confirmar</Button>
        </div>
      </form>
    </Modal>
  );
}

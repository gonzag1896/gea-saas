"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

type ClienteConSaldo = { id: string; nombre: string; telefono: string | null; saldo: number };

export default function CuentaCorrientePage() {
  const [clientes, setClientes] = useState<ClienteConSaldo[]>([]);

  useEffect(() => {
    fetch("/api/cuenta-corriente").then(async (res) => {
      if (res.ok) setClientes((await res.json()).clientes);
    });
  }, []);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Cuenta Corriente" />
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Cliente</Table.HeadCell>
            <Table.HeadCell>Teléfono</Table.HeadCell>
            <Table.HeadCell>Saldo</Table.HeadCell>
            <Table.HeadCell />
          </Table.Row>
        </Table.Head>
        <tbody>
          {clientes.map((c) => (
            <Table.Row key={c.id}>
              <Table.Cell>{c.nombre}</Table.Cell>
              <Table.Cell>{c.telefono ?? "—"}</Table.Cell>
              <Table.Cell className={cn(c.saldo > 0 && "text-danger font-medium")}>{c.saldo.toFixed(2)}</Table.Cell>
              <Table.Cell><a href={`/clientes/${c.id}`} className="text-sm text-primary underline underline-offset-2">Ver detalle</a></Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {clientes.length === 0 && <EmptyState message="Todavía no hay clientes cargados." />}
    </main>
  );
}

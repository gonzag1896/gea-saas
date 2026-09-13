// Excepciones de dominio compartidas entre módulos transaccionales
// (Compras, Ventas, y lo que siga en fases futuras). No son específicas de
// una entidad porque el motivo por el que fallan es el mismo sin importar
// si es una Compra o una Venta: no existe, ya cambió de estado, o la
// cantidad pedida no tiene sentido contra lo que hay.
export class EntidadNoEncontradaError extends Error {}
export class EstadoInvalidoError extends Error {}
export class CantidadInvalidaError extends Error {}

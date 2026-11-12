// Texto del aviso de vencimiento de la mensualidad de la plataforma.
// `diasParaVencer` viene de diasHastaUruguay(): negativo si ya venció.
export function textoAvisoVigencia(diasParaVencer: number, fechaTexto: string) {
  const vencida = diasParaVencer < 0;

  if (vencida) {
    const dias = -diasParaVencer;
    return {
      vencida,
      titulo: "Cuota vencida",
      detalle: `Tu plataforma GEA venció el ${fechaTexto} (hace ${dias} día${dias === 1 ? "" : "s"}). Regularizá el pago de tu mensualidad. Contactanos para renovarla.`,
    };
  }
  if (diasParaVencer === 0) {
    return { vencida, titulo: "La cuota vence hoy", detalle: `Tu plataforma GEA vence hoy (${fechaTexto}). Contactanos para renovarla.` };
  }
  return {
    vencida,
    titulo: `La cuota vence en ${diasParaVencer} día${diasParaVencer === 1 ? "" : "s"}`,
    detalle: `Tu plataforma GEA vence el ${fechaTexto}. Contactanos para renovarla.`,
  };
}

// Mensaje que ve el equipo de una ferretería con el acceso inhabilitado por el
// administrador de la plataforma (falta de pago). `fechaTexto` es la fecha en
// que venció la mensualidad, si hay una cargada.
export function textoAccesoInhabilitado(fechaTexto: string | null, ferreteriaNombre: string) {
  return {
    titulo: "Acceso inhabilitado",
    subtitulo: "Cuota vencida",
    detalle: fechaTexto
      ? `La mensualidad de la plataforma GEA de ${ferreteriaNombre} venció el ${fechaTexto}.`
      : `La mensualidad de la plataforma GEA de ${ferreteriaNombre} está vencida.`,
    accion: "El acceso al sistema está inhabilitado hasta que se regularice el pago. Contactanos para renovarla y volver a usar GEA.",
  };
}

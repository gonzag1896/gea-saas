import { Resend } from "resend";

export async function enviarEmailRecuperacion(email: string, urlReset: string) {
  // Instanciado acá adentro, no a nivel de módulo: con la API key vacía
  // (todavía sin configurar), el constructor de Resend tira apenas se
  // importa el archivo — y Next.js importa este módulo al buildear aunque
  // la función nunca se llegue a ejecutar.
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "GEA <no-responder@gea.local>",
    to: email,
    subject: "Recuperar contraseña — GEA",
    html: `
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p><a href="${urlReset}">Elegir una contraseña nueva</a></p>
      <p>Este link vence en 1 hora. Si no pediste esto, podés ignorar el mensaje.</p>
    `,
  });
}

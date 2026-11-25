import nodemailer from 'nodemailer'

// Correos de la app (por ahora solo "Olvidé mi contraseña") con una cuenta de
// Gmail del equipo y una contraseña de aplicación. Env en Netlify:
// SMTP_USER (el correo de Gmail) y SMTP_PASS (la contraseña de aplicación).

export const mailReady = () => !!(Netlify.env.get('SMTP_USER') && Netlify.env.get('SMTP_PASS'))

export async function sendMail(to: string, subject: string, text: string, html: string) {
  const user = Netlify.env.get('SMTP_USER')!
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: Netlify.env.get('SMTP_PASS')! } })
  await transport.sendMail({ from: `"Alabanza Mi Refugio" <${user}>`, to, subject, text, html })
}

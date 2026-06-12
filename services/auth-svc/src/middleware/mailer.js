import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true, // true para puerto 465, false para otros
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendVerificationEmail(userEmail, userName, verificationUrl) {
    const mailOptions = {
        from: '"Liga 360" <no-reply@liga360.com.ar>',
        to: userEmail,
        subject: 'Verifica tu cuenta en Liga 360',
        html: `
      <h2>Hola ${userName}!</h2>
      <p>Gracias por registrarte. Por favor, verifica tu dirección de correo electrónico haciendo clic en el siguiente enlace:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verificar mi correo</a>
      <p>Este enlace expirará en 24 horas.</p>
    `,
    };

    await transporter.sendMail(mailOptions);
}
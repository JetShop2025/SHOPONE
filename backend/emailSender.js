// backend/emailSender.js
// Servicio para enviar correos con PDF adjunto usando Outlook/Office365

const nodemailer = require('nodemailer');

// Configura aquí tus credenciales de Outlook
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: 'TU_CORREO@outlook.com', // Cambia esto
    pass: 'TU_CONTRASEÑA'           // Cambia esto
  }
});

/**
 * Envía un correo con un PDF adjunto
 * @param {Object} options
 * @param {string} options.to - Correo del destinatario
 * @param {string} options.subject - Asunto del correo
 * @param {string} options.text - Texto del correo
 * @param {string} options.pdfPath - Ruta absoluta al PDF a adjuntar
 * @returns {Promise}
 */
async function sendInvoiceEmail({ to, subject, text, pdfPath }) {
  const mailOptions = {
    from: 'TU_CORREO@outlook.com', // Cambia esto
    to,
    subject,
    text,
    attachments: [
      {
        filename: 'invoice.pdf',
        path: pdfPath,
        contentType: 'application/pdf'
      }
    ]
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendInvoiceEmail };

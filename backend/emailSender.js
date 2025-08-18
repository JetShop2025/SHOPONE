// backend/emailSender.js
// Servicio para enviar correos (HTML o con adjuntos) usando Outlook/Office365
// Ahora parametrizado por variables de entorno para no exponer credenciales.

const nodemailer = require('nodemailer');

// Variables de entorno recomendadas:
// MAIL_HOST=smtp.office365.com
// MAIL_PORT=587
// MAIL_SECURE=false
// MAIL_USER=parts@jetshop.us
// MAIL_PASS=********
// MAIL_FROM="JetShop Parts <parts@jetshop.us>"

const MAIL_HOST = process.env.MAIL_HOST || 'smtp.office365.com';
const MAIL_PORT = parseInt(process.env.MAIL_PORT || '587', 10);
const MAIL_SECURE = (process.env.MAIL_SECURE || 'false').toLowerCase() === 'true'; // false para STARTTLS
const MAIL_USER = process.env.MAIL_USER || 'parts@jetshop.us';
const MAIL_PASS = process.env.MAIL_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || `JetShop Parts <${MAIL_USER}>`;

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: MAIL_PORT,
  secure: MAIL_SECURE, // STARTTLS cuando false + port 587
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS
  },
  tls: {
    // Permitir TLS moderno; se puede ajustar si hay problemas de certificados
    rejectUnauthorized: true
  }
});

// Verificación opcional al inicio (no bloqueante si falla)
transporter.verify().then(()=>{
  console.log('[MAIL] SMTP listo para enviar (', MAIL_HOST, ')');
}).catch(err=>{
  console.warn('[MAIL] No se pudo verificar SMTP:', err.message);
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
async function sendInvoiceEmail({ to, subject, text, pdfPath, from }) {
  const mailOptions = {
    from: from || MAIL_FROM,
    to,
    subject,
    text,
    attachments: pdfPath ? [
      {
        filename: 'invoice.pdf',
        path: pdfPath,
        contentType: 'application/pdf'
      }
    ] : []
  };
  return transporter.sendMail(mailOptions);
}

async function sendHTMLMail({ to, subject, html, text, from, attachments }) {
  const mailOptions = {
    from: from || MAIL_FROM,
    to,
    subject,
    html,
    text: text || undefined,
    attachments: attachments || []
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendInvoiceEmail, sendHTMLMail };

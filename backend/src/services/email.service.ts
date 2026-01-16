import nodemailer from 'nodemailer';
import { config } from '../config/env';

// Create transporter based on environment
const createTransporter = () => {
  // Use configured SMTP settings
  if (config.email.host) {
    return nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    });
  }

  // Fallback: Log to console in development
  console.warn('Email not configured - emails will be logged to console');
  return null;
};

const transporter = createTransporter();

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, html, text } = options;

  if (!transporter) {
    // Log email in development when no SMTP configured
    console.log('\n========== EMAIL (Development Mode) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${text || html}`);
    console.log('===============================================\n');
    return true;
  }

  try {
    await transporter.sendMail({
      from: config.email.from || `"StaplerCup Social" <${config.email.user}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationToken: string
): Promise<boolean> {
  const verificationUrl = `${config.frontendUrl}/verify-email?token=${verificationToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>StaplerCup Social</h1>
        </div>
        <div class="content">
          <h2>Hallo ${name}!</h2>
          <p>Vielen Dank für Ihre Registrierung bei StaplerCup Social.</p>
          <p>Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie auf den folgenden Button klicken:</p>
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">E-Mail bestätigen</a>
          </p>
          <p>Oder kopieren Sie diesen Link in Ihren Browser:</p>
          <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 14px;">
            ${verificationUrl}
          </p>
          <p><strong>Dieser Link ist 24 Stunden gültig.</strong></p>
          <p>Falls Sie diese Registrierung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} StaplerCup Social Media Manager</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hallo ${name}!

Vielen Dank für Ihre Registrierung bei StaplerCup Social.

Bitte bestätigen Sie Ihre E-Mail-Adresse, indem Sie den folgenden Link öffnen:
${verificationUrl}

Dieser Link ist 24 Stunden gültig.

Falls Sie diese Registrierung nicht angefordert haben, können Sie diese E-Mail ignorieren.

Mit freundlichen Grüßen,
StaplerCup Social Media Manager
  `;

  return sendEmail({
    to: email,
    subject: 'Bestätigen Sie Ihre E-Mail-Adresse - StaplerCup Social',
    html,
    text,
  });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const loginUrl = `${config.frontendUrl}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background: linear-gradient(135deg, #2563eb, #4f46e5); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Willkommen bei StaplerCup Social!</h1>
        </div>
        <div class="content">
          <h2>Hallo ${name}!</h2>
          <p>Ihre E-Mail-Adresse wurde erfolgreich bestätigt.</p>
          <p>Sie können sich jetzt mit Ihren Zugangsdaten anmelden:</p>
          <p style="text-align: center;">
            <a href="${loginUrl}" class="button">Jetzt anmelden</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} StaplerCup Social Media Manager</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Willkommen bei StaplerCup Social!',
    html,
  });
}

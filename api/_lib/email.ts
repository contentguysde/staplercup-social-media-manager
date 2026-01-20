import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    console.log('Email not configured - emails will be logged to console');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationToken: string
): Promise<boolean> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
  const fromEmail = process.env.SMTP_FROM || 'noreply@staplercup.de';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .button { display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>StaplerCup Social</h1>
        </div>
        <div class="content">
          <h2>Hallo ${name}!</h2>
          <p>Vielen Dank für deine Registrierung bei StaplerCup Social.</p>
          <p>Bitte klicke auf den folgenden Button, um deine E-Mail-Adresse zu bestätigen:</p>
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">E-Mail bestätigen</a>
          </p>
          <p>Oder kopiere diesen Link in deinen Browser:</p>
          <p style="word-break: break-all; background: #e5e7eb; padding: 10px; border-radius: 4px; font-size: 14px;">
            ${verificationUrl}
          </p>
          <p><strong>Hinweis:</strong> Dieser Link ist 24 Stunden gültig.</p>
        </div>
        <div class="footer">
          <p>StaplerCup Social Media Manager</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const transport = getTransporter();

  if (!transport) {
    console.log('=== VERIFICATION EMAIL (Console Mode) ===');
    console.log(`To: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log('==========================================');
    return true;
  }

  try {
    await transport.sendMail({
      from: fromEmail,
      to: email,
      subject: 'StaplerCup Social - E-Mail bestätigen',
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

export interface AssignmentEmailData {
  assigneeEmail: string;
  assigneeName: string;
  assignerName: string;
  interactionContent: string;
  interactionType: 'comment' | 'dm' | 'mention';
  interactionFrom: string;
  interactionTimestamp: string;
  platform: string;
}

export async function sendAssignmentNotificationEmail(data: AssignmentEmailData): Promise<boolean> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const fromEmail = process.env.SMTP_FROM || 'noreply@staplercup.de';

  const typeLabels: Record<string, string> = {
    comment: 'Kommentar',
    dm: 'Direktnachricht',
    mention: 'Erwähnung',
  };

  const platformLabels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
  };

  const typeLabel = typeLabels[data.interactionType] || data.interactionType;
  const platformLabel = platformLabels[data.platform] || data.platform;

  const formattedTime = new Date(data.interactionTimestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Truncate content if too long
  const truncatedContent = data.interactionContent.length > 200
    ? data.interactionContent.substring(0, 200) + '...'
    : data.interactionContent;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
        .interaction-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .interaction-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .platform-badge { display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
        .type-badge { display: inline-block; background: #f3f4f6; color: #4b5563; padding: 4px 10px; border-radius: 12px; font-size: 12px; }
        .interaction-content { color: #374151; font-size: 15px; line-height: 1.5; }
        .interaction-meta { color: #6b7280; font-size: 13px; margin-top: 12px; }
        .button { display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; background: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Neue Zuweisung</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">StaplerCup Social</p>
        </div>
        <div class="content">
          <h2 style="margin-top: 0;">Hallo ${data.assigneeName}!</h2>
          <p><strong>${data.assignerName}</strong> hat dir eine Interaktion zugewiesen:</p>

          <div class="interaction-box">
            <div class="interaction-header">
              <span class="platform-badge">${platformLabel}</span>
              <span class="type-badge">${typeLabel}</span>
            </div>
            <div class="interaction-content">
              <strong>@${data.interactionFrom}</strong>
              <p style="margin: 8px 0 0 0;">${truncatedContent}</p>
            </div>
            <div class="interaction-meta">
              ${formattedTime}
            </div>
          </div>

          <p style="text-align: center;">
            <a href="${frontendUrl}" class="button">Im Dashboard öffnen</a>
          </p>
        </div>
        <div class="footer">
          <p style="margin: 0;">Du erhältst diese E-Mail, weil dir eine Interaktion im StaplerCup Social Media Manager zugewiesen wurde.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const transport = getTransporter();

  if (!transport) {
    console.log('=== ASSIGNMENT NOTIFICATION EMAIL (Console Mode) ===');
    console.log(`To: ${data.assigneeEmail}`);
    console.log(`Assignee: ${data.assigneeName}`);
    console.log(`Assigned by: ${data.assignerName}`);
    console.log(`Interaction: ${typeLabel} von @${data.interactionFrom}`);
    console.log(`Content: ${truncatedContent}`);
    console.log('=====================================================');
    return true;
  }

  try {
    await transport.sendMail({
      from: fromEmail,
      to: data.assigneeEmail,
      subject: `StaplerCup Social - Neue Zuweisung von ${data.assignerName}`,
      html: htmlContent,
    });
    return true;
  } catch (error) {
    console.error('Failed to send assignment notification email:', error);
    return false;
  }
}

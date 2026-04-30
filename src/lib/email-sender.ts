import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass }
  };
}

export async function sendEmailWithAttachment(
  to: string,
  subject: string,
  text: string,
  attachmentBuffer: Buffer,
  attachmentName: string,
  maxRetries: number = 3
): Promise<boolean> {
  const config = getEmailConfig();
  if (!config) {
    console.error('Email configuration not found. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.');
    return false;
  }

  const transporter = nodemailer.createTransport(config);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: `"AlphaSight AI" <${config.auth.user}>`,
        to,
        subject,
        text,
        attachments: [
          {
            filename: attachmentName,
            content: attachmentBuffer,
          }
        ]
      });

      console.log(`Email sent successfully to ${to}, message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Email send attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  console.error(`Failed to send email to ${to} after ${maxRetries} attempts:`, lastError?.message);
  return false;
}

export async function sendDailyBriefEmail(
  to: string,
  aiSummary: string,
  attachmentBuffer: Buffer
): Promise<boolean> {
  const subject = 'Your Daily Stock Brief';
  const text = `Good morning!\n\nHere's your daily stock market summary:\n\n${aiSummary}\n\nPlease find the detailed Excel report attached.\n\nBest regards,\nAlphaSight AI`;

  return sendEmailWithAttachment(to, subject, text, attachmentBuffer, 'daily-stock-report.xlsx');
}
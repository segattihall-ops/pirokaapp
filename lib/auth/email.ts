import nodemailer from 'nodemailer';

/**
 * Email configuration for magic links
 * Uses SMTP from environment (Gmail, SendGrid, etc.)
 */
const transporter = process.env.EMAIL_SERVER
  ? nodemailer.createTransport(process.env.EMAIL_SERVER)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || '"πroka" <no-reply@piroka.app>';

/**
 * Send magic link email for password-less login
 * Requires EMAIL_SERVER SMTP URL in .env
 */
export async function sendMagicLinkEmail(
  email: string,
  url: string,
  requestId: string
): Promise<{ success: boolean; messageId?: string }> {
  if (!transporter) {
    console.warn('Email not configured. Magic link URL:', url);
    return { success: false };
  }

  try {
    const result = await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: '🔗 Your πroka login link (expires in 24h)',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
              .container { max-width: 500px; margin: 0 auto; padding: 20px; }
              .button {
                display: inline-block;
                background: #00d084;
                color: #1a1a1a;
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                font-weight: bold;
                margin-top: 16px;
              }
              .footer { color: #999; font-size: 12px; margin-top: 24px; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Welcome to πroka 🌍</h2>
              <p>Click the button below to log in to your account:</p>
              <a href="${url}" class="button">Sign In</a>
              <p style="margin-top: 24px; color: #666;">
                Or paste this link in your browser:<br>
                <code>${url}</code>
              </p>
              <div class="footer">
                <p>This link expires in 24 hours.</p>
                <p>If you didn't request this, you can safely ignore this email.</p>
                <p>πroka · Location-based connection</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
        Welcome to πroka!

        Click this link to sign in:
        ${url}

        This link expires in 24 hours.

        If you didn't request this, you can safely ignore this email.
      `,
    });

    console.log(`Magic link sent to ${email} (Message ID: ${result.messageId})`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Failed to send magic link:', error);
    return { success: false };
  }
}

/**
 * Send verification email (for confirmation emails, etc.)
 */
export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<{ success: boolean }> {
  if (!transporter) {
    console.warn('Email not configured. Verification code:', code);
    return { success: false };
  }

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: '✓ Verify your πroka account',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
              .container { max-width: 500px; margin: 0 auto; padding: 20px; }
              .code {
                background: #f5f5f5;
                padding: 16px;
                border-radius: 8px;
                text-align: center;
                font-size: 28px;
                font-weight: bold;
                letter-spacing: 4px;
                font-family: monospace;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Verify Your Email</h2>
              <p>Use this code to verify your πroka account:</p>
              <div class="code">${code}</div>
              <p style="color: #666; margin-top: 16px;">This code expires in 1 hour.</p>
            </div>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false };
  }
}

/**
 * Check if email is configured
 */
export function isEmailConfigured(): boolean {
  return !!transporter && !!process.env.EMAIL_SERVER;
}

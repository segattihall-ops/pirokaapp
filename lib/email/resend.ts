import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;

export const resend = apiKey ? new Resend(apiKey) : null;

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email using Resend
 * Falls back to console.log in development if API key not set
 */
export async function sendEmail(template: EmailTemplate) {
  const from = process.env.EMAIL_FROM || 'πroka <noreply@piroka.app>';

  if (!resend) {
    // Development mode: log to console
    console.log('[EMAIL DEV MODE]', {
      from,
      to: template.to,
      subject: template.subject,
      html: template.html.substring(0, 200) + '...',
    });
    return { success: true, id: 'dev-mode' };
  }

  try {
    const result = await resend.emails.send({
      from,
      to: template.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      headers: {
        'X-Entity-Ref-ID': new Date().getTime().toString(),
      },
    });

    if (result.error) {
      console.error('Resend email error:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true, id: result.data?.id };
  } catch (err) {
    console.error('Failed to send email:', err);
    return { success: false, error: err };
  }
}

/**
 * Send verification email with code
 */
export async function sendVerificationEmail(email: string, code: string) {
  const verifyUrl = `${process.env.NEXTAUTH_URL || 'https://piroka.app'}/auth/verify?code=${code}&email=${encodeURIComponent(email)}`;

  return sendEmail({
    to: email,
    subject: 'Verify your ΠROKA account',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your ΠROKA account:</p>
        <p>
          <a href="${verifyUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          ">
            Verify Email
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Or paste this code: <code style="background: #f0f0f0; padding: 2px 6px;">${code}</code>
        </p>
        <p style="color: #999; font-size: 12px;">
          This link expires in 1 hour.
        </p>
      </div>
    `,
    text: `Verify your ΠROKA account: ${verifyUrl}`,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  return sendEmail({
    to: email,
    subject: 'Reset your ΠROKA password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your password:</p>
        <p>
          <a href="${resetUrl}" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          ">
            Reset Password
          </a>
        </p>
        <p style="color: #999; font-size: 12px;">
          This link expires in 24 hours. If you didn't request this, ignore this email.
        </p>
      </div>
    `,
    text: `Reset your password: ${resetUrl}`,
  });
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(email: string, name?: string) {
  return sendEmail({
    to: email,
    subject: 'Welcome to ΠROKA',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h2>Welcome to ΠROKA${name ? `, ${name}` : ''}!</h2>
        <p>Your account is ready. Complete your profile and start exploring.</p>
        <p>
          <a href="${process.env.NEXTAUTH_URL || 'https://piroka.app'}/onboarding" style="
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          ">
            Continue to Profile
          </a>
        </p>
      </div>
    `,
  });
}

/**
 * Send notification email (new match, message, etc.)
 */
export async function sendNotificationEmail(
  email: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionLabel?: string
) {
  return sendEmail({
    to: email,
    subject: `${title} - ΠROKA`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <h2>${title}</h2>
        <p>${message}</p>
        ${
          actionUrl && actionLabel
            ? `
          <p>
            <a href="${actionUrl}" style="
              display: inline-block;
              padding: 12px 24px;
              background-color: #2563eb;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
            ">
              ${actionLabel}
            </a>
          </p>
        `
            : ''
        }
        <p style="color: #999; font-size: 12px;">
          You received this because you have notifications enabled.
          <a href="${process.env.NEXTAUTH_URL || 'https://piroka.app'}/settings/notifications">Manage preferences</a>
        </p>
      </div>
    `,
  });
}

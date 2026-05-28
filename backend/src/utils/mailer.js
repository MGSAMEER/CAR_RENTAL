const logger = require('./logger');

// ─── Brevo HTTP API Configuration ────────────────────────────────────────────
// Uses Brevo's REST API (HTTPS on port 443) instead of SMTP (port 587).
// Render blocks outbound SMTP ports, so HTTP API is the only reliable method.
// ─────────────────────────────────────────────────────────────────────────────

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || process.env.SMTP_PASS;

// Parse sender from SMTP_FROM: "DriveEasy <email@example.com>" → { name, email }
const parseSender = () => {
  const raw = process.env.SMTP_FROM || '';
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'DriveEasy', email: process.env.SMTP_USER || 'noreply@driveeasy.com' };
};

const emailConfigured = !!BREVO_API_KEY;

logger.info('[MAILER INIT] Checking Brevo HTTP API configuration...');
logger.info(`  - BREVO_API_KEY: ${BREVO_API_KEY ? BREVO_API_KEY.substring(0, 12) + '...' : '❌ NOT SET'}`);
logger.info(`  - SMTP_FROM: ${process.env.SMTP_FROM || '❌ NOT SET'}`);
logger.info(`  - CLIENT_URL: ${process.env.CLIENT_URL || '❌ NOT SET (will default to localhost)'}`);
logger.info(`  - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

if (!emailConfigured) {
  logger.warn('[MAILER] ⚠️ No Brevo API key found. All email sending is DISABLED.');
  logger.warn('[MAILER] Set BREVO_API_KEY in your Render environment variables.');
}

const sendMailAsync = async (options, maxRetries = 3) => {
  logger.info(`[MAILER] Initiating email send to: ${options.to} (Subject: "${options.subject}")`);

  if (!emailConfigured) {
    logger.warn(`[MAILER] ⚠️ Brevo API key not configured. Skipping email to: ${options.to}`);
    return false;
  }

  const sender = parseSender();
  const payload = {
    sender: { name: sender.name, email: sender.email },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.html,
  };

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        logger.info(`[MAILER] ✅ Email sent to: ${options.to}. MessageId: ${data.messageId || 'N/A'}`);
        return true;
      }

      throw new Error(`Brevo API ${response.status}: ${data.message || JSON.stringify(data)}`);
    } catch (err) {
      attempt++;
      logger.warn(`[MAILER] ⚠️ Attempt ${attempt}/${maxRetries} failed for ${options.to}: ${err.message}`);

      if (attempt >= maxRetries) {
        logger.error(`[MAILER] ❌ Final failure sending email to ${options.to}: ${err.message}`);
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

// ─── Mobile-Friendly Email Template ──────────────────────────────────────────

const wrapHtml = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: 'Inter', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #111827; }
    .container { background-color: #ffffff; max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { text-align: center; margin-bottom: 24px; }
    .brand { color: #2563eb; font-size: 24px; font-weight: bold; margin: 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .table td { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .label { color: #6b7280; width: 40%; }
    .value { font-weight: 600; text-align: right; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1 class="brand">DriveEasy</h1></div>
    ${content}
    <div class="footer">
      © ${new Date().getFullYear()} DriveEasy Premium Car Rentals. All rights reserved.<br>
      If you need assistance, reply to this email.
    </div>
  </div>
</body>
</html>
`;

// ─── Email Services ──────────────────────────────────────────────────────────

const getClientUrl = () => {
  const url = process.env.CLIENT_URL || 'http://localhost:3000';
  return url.replace(/\/+$/, '');
};

const sendWelcomeEmail = async (userEmail, userName) => {
  logger.info(`[MAILER] Preparing welcome email for ${userEmail}`);
  const content = `
    <h2>Welcome to the fleet, ${userName}! 🚗</h2>
    <p>Your account is fully set up. Experience the thrill of the open road with our premium selection of vehicles.</p>
    <div style="text-align: center;">
      <a href="${getClientUrl()}/cars" class="button">Book Your First Ride</a>
    </div>
  `;
  return sendMailAsync({ to: userEmail, subject: 'Welcome to DriveEasy! 🚗', html: wrapHtml(content) });
};

const sendBookingConfirmation = async (userEmail, bookingDetails) => {
  logger.info(`[MAILER] Preparing booking confirmation email for ${userEmail}`);
  const carName = bookingDetails?.car ? `${bookingDetails.car.brand} ${bookingDetails.car.name}` : 'your car';
  const start = bookingDetails?.startDate ? new Date(bookingDetails.startDate).toDateString() : '—';
  const end = bookingDetails?.endDate ? new Date(bookingDetails.endDate).toDateString() : '—';
  const cost = bookingDetails?.totalCost ?? '—';
  const intentId = bookingDetails?.stripeIntentId ?? '—';

  const content = `
    <h2>Your Booking is Confirmed! ✅</h2>
    <p>Thank you for booking with DriveEasy. Your vehicle is reserved and ready for you.</p>
    <table class="table">
      <tr><td class="label">Vehicle</td><td class="value">${carName}</td></tr>
      <tr><td class="label">Start Date</td><td class="value">${start}</td></tr>
      <tr><td class="label">End Date</td><td class="value">${end}</td></tr>
      <tr><td class="label">Total Amount</td><td class="value">₹${cost}</td></tr>
      <tr><td class="label">Reference ID</td><td class="value" style="font-size: 0.8em; color: #9ca3af;">${intentId}</td></tr>
    </table>
    <div style="text-align: center;">
      <a href="${getClientUrl()}/dashboard" class="button">View My Bookings</a>
    </div>
  `;
  return sendMailAsync({ to: userEmail, subject: '🚗 DriveEasy: Booking Confirmed', html: wrapHtml(content) });
};

const sendPaymentSuccessEmail = async (userEmail, amount, receiptUrl) => {
  logger.info(`[MAILER] Preparing payment success email for ${userEmail}`);
  const content = `
    <h2>Payment Received 💳</h2>
    <p>We successfully processed your payment of <strong>₹${amount}</strong>.</p>
    <p>Your booking status is now officially PAID and secured.</p>
    ${receiptUrl ? `<div style="text-align: center;"><a href="${receiptUrl}" class="button">View Stripe Receipt</a></div>` : ''}
  `;
  return sendMailAsync({ to: userEmail, subject: 'Receipt: Payment Successful', html: wrapHtml(content) });
};

const sendRefundNotification = async (userEmail, amount, carName) => {
  logger.info(`[MAILER] Preparing refund notification email for ${userEmail}`);
  const content = `
    <h2>Refund Initiated 💸</h2>
    <p>Your booking for <strong>${carName}</strong> has been cancelled.</p>
    <p>A refund of <strong>₹${amount}</strong> has been successfully initiated to your original payment method.</p>
    <p style="font-size: 0.9em; color: #6b7280; margin-top: 10px;">Please allow 3-5 business days for the funds to appear in your account.</p>
  `;
  return sendMailAsync({ to: userEmail, subject: 'DriveEasy: Refund Processed', html: wrapHtml(content) });
};

const sendEmailVerification = async (userEmail, token) => {
  const verifyLink = `${getClientUrl()}/verify-email?token=${token}`;
  logger.info(`[MAILER] Preparing verification email for ${userEmail}. Link: ${verifyLink}`);

  const content = `
    <h2>Action Required: Verify Email 🛡️</h2>
    <p>Please confirm your email address to unlock all DriveEasy features and secure your account.</p>
    <div style="text-align: center;">
      <a href="${verifyLink}" class="button">Verify My Account</a>
    </div>
    <p style="margin-top: 20px; font-size: 0.9em; color: #374151;">
      Or copy and paste this link into your browser:<br>
      <a href="${verifyLink}" style="color: #2563eb; word-break: break-all;">${verifyLink}</a>
    </p>
    <p style="font-size: 0.85em; color: #9ca3af; margin-top: 20px;">If you didn't request this, ignore this email safely.</p>
  `;
  return sendMailAsync({ to: userEmail, subject: 'Verify Your DriveEasy Account', html: wrapHtml(content) });
};

const sendPasswordReset = async (userEmail, token) => {
  const resetLink = `${getClientUrl()}/reset-password?token=${token}`;
  logger.info(`[MAILER] Preparing password reset email for ${userEmail}. Link: ${resetLink}`);

  const content = `
    <h2>Reset Your Password 🔐</h2>
    <p>We received a request to reset your password. Click below to create a new one.</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <p style="margin-top: 20px; font-size: 0.9em; color: #374151;">
      Or copy and paste this link into your browser:<br>
      <a href="${resetLink}" style="color: #2563eb; word-break: break-all;">${resetLink}</a>
    </p>
    <p style="font-size: 0.85em; color: #9ca3af; margin-top: 20px;">This secure link expires in 1 hour. If you didn't request this, your account is still safe.</p>
  `;
  return sendMailAsync({ to: userEmail, subject: 'DriveEasy: Password Reset Request', html: wrapHtml(content) });
};

const sendBookingCancellation = async (userEmail, bookingDetails) => {
  const carName = bookingDetails?.car ? `${bookingDetails.car.brand} ${bookingDetails.car.name}` : 'your car';
  const start = bookingDetails?.startDate ? new Date(bookingDetails.startDate).toDateString() : '—';
  const end = bookingDetails?.endDate ? new Date(bookingDetails.endDate).toDateString() : '—';
  const originalCost = bookingDetails?.totalCost ?? 0;
  const refundAmount = bookingDetails?.refundAmount ?? 0;
  const refundStatus = bookingDetails?.refundStatus ?? 'not_requested';
  
  let refundMessage = '';
  if (refundStatus === 'processed') {
    refundMessage = `<p style="font-size: 1.1em;">A refund of <strong>₹${refundAmount}</strong> has been processed to your original payment method.</p>`;
  } else if (refundStatus === 'pending') {
    refundMessage = `<p style="font-size: 1.1em;">A refund of <strong>₹${refundAmount}</strong> is being processed.</p>`;
  } else if (refundAmount === 0) {
    refundMessage = `<p style="font-size: 1.1em;">No refund is applicable as per our cancellation policy.</p>`;
  } else {
    refundMessage = `<p style="font-size: 1.1em;">No refund was requested for this cancellation.</p>`;
  }

  const content = `
    <h2 style="color: #dc2626;">Booking Cancelled 🚫</h2>
    <p>Your booking has been successfully cancelled.</p>
    <table class="table">
      <tr><td class="label">Vehicle</td><td class="value">${carName}</td></tr>
      <tr><td class="label">Original Dates</td><td class="value">${start} → ${end}</td></tr>
      <tr><td class="label">Original Amount</td><td class="value">₹${originalCost}</td></tr>
      <tr><td class="label">Cancellation Policy</td><td class="value" style="font-size: 0.9em;">>24h: 100% · 6-24h: 50% · &lt;6h: 0%</td></tr>
    </table>
    ${refundMessage}
    <p style="font-size: 0.9em; color: #6b7280; margin-top: 10px;">Please allow 3-5 business days for refunds to reflect in your account.</p>
  `;
  return sendMailAsync({ to: userEmail, subject: 'DriveEasy: Booking Cancelled', html: wrapHtml(content) });
};

const sendAdminNotification = async (adminEmail, title, message) => {
  logger.info(`[MAILER] Preparing admin notification email for ${adminEmail}`);
  const content = `
    <h2 style="color: #dc2626;">System Alert: ${title} 🛑</h2>
    <p>${message}</p>
    <div style="text-align: center;">
      <a href="${getClientUrl()}/admin" class="button">Go to Admin Dashboard</a>
    </div>
  `;
  return sendMailAsync({ to: adminEmail, subject: `[Admin Alert] ${title}`, html: wrapHtml(content) });
};

const getMailerHealth = () => {
  return {
    configured: emailConfigured,
    method: 'Brevo HTTP API',
    apiKeyPresent: !!BREVO_API_KEY,
  };
};

module.exports = {
  sendWelcomeEmail,
  sendBookingConfirmation,
  sendPaymentSuccessEmail,
  sendRefundNotification,
  sendEmailVerification,
  sendPasswordReset,
  sendBookingCancellation,
  sendAdminNotification,
  getMailerHealth,
  sendMailAsync
};
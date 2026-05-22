const nodemailer = require('nodemailer');
const logger = require('./logger');

// Production SMTP Configuration
const emailConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = emailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE === 'true', // strictly check the env variable
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      pool: true, // Use pooled connections for high throughput
      maxConnections: 5,
      maxMessages: 100,
    })
  : null;

/**
 * Robust async mail sender with exponential backoff retries.
 * Guarantees that failures NEVER crash the main Node event loop.
 */
const sendMailAsync = async (options, maxRetries = 3) => {
  if (!emailConfigured || !transporter) {
    logger.warn(`[MAILER] Email not configured. Skipping email to: ${options.to}`);
    return;
  }

  // Fire-and-forget wrapper to release the event loop immediately
  setImmediate(async () => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || `"DriveEasy Premium" <${process.env.SMTP_USER}>`,
          ...options,
        });
        logger.info(`[MAILER] ✅ Email successfully sent to: ${options.to}`);
        return; // Success, exit retry loop
      } catch (err) {
        attempt++;
        logger.warn(`[MAILER] ⚠️ Attempt ${attempt}/${maxRetries} failed for ${options.to}: ${err.message}`);
        
        if (attempt >= maxRetries) {
          logger.error(`[MAILER] ❌ Final failure sending email to ${options.to}: ${err.message}`);
          return;
        }
        
        // Exponential backoff (1s, 2s, 4s...)
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  });
};

// --- Mobile Friendly Template Wrapper ---
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

// --- Services ---

const sendWelcomeEmail = (userEmail, userName) => {
  const content = `
    <h2>Welcome to the fleet, ${userName}! 🚗</h2>
    <p>Your account is fully set up. Experience the thrill of the open road with our premium selection of vehicles.</p>
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/cars" class="button">Book Your First Ride</a>
    </div>
  `;
  sendMailAsync({ to: userEmail, subject: 'Welcome to DriveEasy! 🚗', html: wrapHtml(content) });
};

const sendBookingConfirmation = (userEmail, bookingDetails) => {
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
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" class="button">View My Bookings</a>
    </div>
  `;
  sendMailAsync({ to: userEmail, subject: '🚗 DriveEasy: Booking Confirmed', html: wrapHtml(content) });
};

const sendPaymentSuccessEmail = (userEmail, amount, receiptUrl) => {
  const content = `
    <h2>Payment Received 💳</h2>
    <p>We successfully processed your payment of <strong>₹${amount}</strong>.</p>
    <p>Your booking status is now officially PAID and secured.</p>
    ${receiptUrl ? `<div style="text-align: center;"><a href="${receiptUrl}" class="button">View Stripe Receipt</a></div>` : ''}
  `;
  sendMailAsync({ to: userEmail, subject: 'Receipt: Payment Successful', html: wrapHtml(content) });
};

const sendRefundNotification = (userEmail, amount, carName) => {
  const content = `
    <h2>Refund Initiated 💸</h2>
    <p>Your booking for <strong>${carName}</strong> has been cancelled.</p>
    <p>A refund of <strong>₹${amount}</strong> has been successfully initiated to your original payment method.</p>
    <p style="font-size: 0.9em; color: #6b7280; margin-top: 10px;">Please allow 3-5 business days for the funds to appear in your account.</p>
  `;
  sendMailAsync({ to: userEmail, subject: 'DriveEasy: Refund Processed', html: wrapHtml(content) });
};

const sendEmailVerification = (userEmail, token) => {
  const verifyLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const content = `
    <h2>Action Required: Verify Email 🛡️</h2>
    <p>Please confirm your email address to unlock all DriveEasy features and secure your account.</p>
    <div style="text-align: center;">
      <a href="${verifyLink}" class="button">Verify My Account</a>
    </div>
    <p style="font-size: 0.85em; color: #9ca3af; margin-top: 20px;">If you didn't request this, ignore this email safely.</p>
  `;
  sendMailAsync({ to: userEmail, subject: 'Verify Your DriveEasy Account', html: wrapHtml(content) });
};

const sendPasswordReset = (userEmail, token) => {
  const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const content = `
    <h2>Reset Your Password 🔐</h2>
    <p>We received a request to reset your password. Click below to create a new one.</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Password</a>
    </div>
    <p style="font-size: 0.85em; color: #9ca3af; margin-top: 20px;">This secure link expires in 1 hour. If you didn't request this, your account is still safe.</p>
  `;
  sendMailAsync({ to: userEmail, subject: 'DriveEasy: Password Reset Request', html: wrapHtml(content) });
};

const sendAdminNotification = (adminEmail, title, message) => {
  const content = `
    <h2 style="color: #dc2626;">System Alert: ${title} 🛑</h2>
    <p>${message}</p>
    <div style="text-align: center;">
      <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin" class="button">Go to Admin Dashboard</a>
    </div>
  `;
  sendMailAsync({ to: adminEmail, subject: `[Admin Alert] ${title}`, html: wrapHtml(content) });
};

const getMailerHealth = () => {
  return {
    configured: emailConfigured,
    idle: transporter ? transporter.isIdle() : false,
  };
};

module.exports = { 
  sendWelcomeEmail, 
  sendBookingConfirmation, 
  sendPaymentSuccessEmail,
  sendRefundNotification,
  sendEmailVerification, 
  sendPasswordReset,
  sendAdminNotification,
  getMailerHealth
};

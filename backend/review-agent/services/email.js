'use strict';

const nodemailer = require('nodemailer');
const config = require('../../common/config');
const logger = require('../../common/utils/logger');

// ---------------------------------------------------------------------------
// Email Service — Sends notification emails for escalation reviews
// ---------------------------------------------------------------------------

let transporter = null;

/**
 * Lazy-initialize the Nodemailer transporter.
 * @private
 * @returns {import('nodemailer').Transporter}
 */
function getTransporter() {
  if (transporter) return transporter;

  const smtp = config.reviewAgent.smtp;

  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    // Connection pool for better performance
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  logger.info('Email transporter initialized', {
    host: smtp.host,
    port: smtp.port,
  });

  return transporter;
}

/**
 * Send an escalation notification email for a critical review.
 *
 * @param {Object} review — Review document from MongoDB.
 * @returns {Promise<Object>} — Nodemailer send result.
 */
async function sendEscalationEmail(review) {
  const transport = getTransporter();
  const smtp = config.reviewAgent.smtp;
  const emails = config.reviewAgent.emails;

  const recipients = [
    emails.support,
    emails.admin,
  ].filter(Boolean).join(', ');

  if (!recipients) {
    logger.warn('No escalation email recipients configured, skipping email send');
    return null;
  }

  const subject = `⚠️ Critical Google Review Detected — ${review.authorName}`;

  const htmlBody = buildEscalationEmailHtml(review);
  const textBody = buildEscalationEmailText(review);

  const mailOptions = {
    from: `"Ginger Review System" <${smtp.from}>`,
    to: recipients,
    subject,
    html: htmlBody,
    text: textBody,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    logger.info('Escalation email sent', {
      reviewId: review.reviewId,
      messageId: info?.messageId,
      recipients,
    });
    return info;
  } catch (error) {
    logger.error('Failed to send escalation email', {
      reviewId: review.reviewId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Build the HTML body for an escalation email.
 * @private
 */
function buildEscalationEmailHtml(review) {
  const starIcons = '⭐'.repeat(review.starRating) + '☆'.repeat(5 - review.starRating);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:20px auto;">
    <tr>
      <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding:24px; border-radius:12px 12px 0 0;">
        <h1 style="color:#ffffff; margin:0; font-size:20px; font-weight:600;">
          ⚠️ Critical Review Alert
        </h1>
        <p style="color:#fecaca; margin:4px 0 0; font-size:14px;">
          Immediate attention required
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff; padding:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding-bottom:16px; border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 4px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Customer</p>
              <p style="margin:0; font-size:16px; font-weight:600; color:#111827;">${escapeHtml(review.authorName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0; border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 4px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Rating</p>
              <p style="margin:0; font-size:20px;">${starIcons}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0; border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 8px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Review</p>
              <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; border-radius:0 8px 8px 0;">
                <p style="margin:0; font-size:14px; line-height:1.6; color:#1f2937;">${escapeHtml(review.comment || 'No comment provided')}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0; border-bottom:1px solid #e5e7eb;">
              <p style="margin:0 0 4px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">AI Analysis</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:4px 0; font-size:14px; color:#6b7280; width:120px;">Sentiment:</td>
                  <td style="padding:4px 0; font-size:14px; font-weight:600; color:#dc2626;">${escapeHtml(review.sentiment)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-size:14px; color:#6b7280;">Concern Type:</td>
                  <td style="padding:4px 0; font-size:14px; color:#1f2937;">${escapeHtml(review.concernType || 'general')}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-size:14px; color:#6b7280;">Confidence:</td>
                  <td style="padding:4px 0; font-size:14px; color:#1f2937;">${((review.confidence || 0) * 100).toFixed(0)}%</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 0;">
              <p style="margin:0 0 8px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Suggested Response</p>
              <div style="background:#f0fdf4; border-left:4px solid #16a34a; padding:12px 16px; border-radius:0 8px 8px 0;">
                <p style="margin:0; font-size:14px; line-height:1.6; color:#1f2937;">${escapeHtml(review.generatedReply || 'No reply generated')}</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb; padding:16px 24px; border-radius:0 0 12px 12px; border-top:1px solid #e5e7eb;">
        <p style="margin:0; font-size:12px; color:#9ca3af; text-align:center;">
          This is an automated notification from the Ginger Review Management System.<br>
          Please review and respond to this review promptly.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build the plain-text body for an escalation email.
 * @private
 */
function buildEscalationEmailText(review) {
  return `⚠️ CRITICAL REVIEW ALERT

Customer: ${review.authorName}
Rating: ${'★'.repeat(review.starRating)}${'☆'.repeat(5 - review.starRating)}

Review:
${review.comment || 'No comment provided'}

AI Analysis:
- Sentiment: ${review.sentiment}
- Concern Type: ${review.concernType || 'general'}
- Confidence: ${((review.confidence || 0) * 100).toFixed(0)}%

Suggested Response:
${review.generatedReply || 'No reply generated'}

---
This is an automated notification from the Ginger Review Management System.
Please review and respond to this review promptly.`;
}

/**
 * Escape HTML entities to prevent XSS in email content.
 * @private
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { sendEscalationEmail };

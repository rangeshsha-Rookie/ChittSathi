const nodemailer = require('nodemailer');
const axios = require('axios');

function parseFrom(fromValue) {
  if (!fromValue) {
    return { email: 'noreply@chittsaathi.edu', name: 'ChittSaathi' };
  }

  const match = fromValue.match(/^(.*)<(.+@.+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, ''),
      email: match[2].trim()
    };
  }

  return { email: fromValue.trim(), name: 'ChittSaathi' };
}

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} [options.html] - HTML content (optional)
 */
async function sendEmail(options) {
  try {
    const brevoApiKey = process.env.BREVO_API_KEY || process.env.envBREVO_API_KEY;
    const resendApiKey = process.env.RESEND_API_KEY;
    const sender = parseFrom(process.env.EMAIL_FROM);

    // Prefer Brevo when available, but do not hard-fail if provider rejects auth.
    if (brevoApiKey) {
      try {
        const toList = Array.isArray(options.to) ? options.to : [options.to];

        const response = await axios.post(
          'https://api.brevo.com/v3/smtp/email',
          {
            sender,
            to: toList.map((email) => ({ email })),
            subject: options.subject,
            htmlContent: options.html || `<p>${options.text || ''}</p>`,
            textContent: options.text
          },
          {
            headers: {
              'api-key': brevoApiKey,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        return {
          success: true,
          messageId: response.data && (response.data.messageId || response.data.messageIds || response.data.id)
        };
      } catch (brevoError) {
        console.warn('Brevo email failed, trying next provider:', brevoError.response?.status || brevoError.message);
      }
    }

    // Fallback to Resend when configured.
    if (resendApiKey) {
      try {
        const response = await axios.post(
          'https://api.resend.com/emails',
          {
            from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: options.subject,
            html: options.html || `<p>${options.text || ''}</p>`,
            text: options.text
          },
          {
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        return {
          success: true,
          messageId: response.data && (response.data.id || response.data.messageId)
        };
      } catch (resendError) {
        console.warn('Resend email failed, falling back to SMTP:', resendError.response?.status || resendError.message);
      }
    }

    // Check if we're in development mode
    const isDev = process.env.NODE_ENV === 'development';
    let transporter;

    if (isDev && process.env.USE_TEST_EMAIL === 'true') {
      // Create a test account for development
      console.log('Creating test account for email...');
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      console.log('Using test email account:', testAccount.user);
    } else {
      // Configure real email service
      transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    }
    
    // Set up email options
    const fallbackFrom = process.env.EMAIL_USERNAME
      ? `ChittSaathi <${process.env.EMAIL_USERNAME}>`
      : 'ChittSaathi <noreply@chittsaathi.edu>';

    const mailOptions = {
      from: fallbackFrom,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };
    
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    
    // Log email preview URL in development
    if (isDev) {
      console.log('Email sent successfully!');
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error };
  }
}

module.exports = sendEmail;

const nodemailer = require('nodemailer')

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS ||
      process.env.EMAIL_USER === 'your_gmail@gmail.com') {
    return null
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  })
}

async function sendPasswordResetEmail(toEmail, otp) {
  const transporter = getTransporter()
  if (!transporter) {
    throw new Error('Email not configured. Add EMAIL_USER and EMAIL_PASS to your .env file.')
  }
  await transporter.sendMail({
    from: `"BookStore" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `${otp} is your BookStore reset code`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8f9fa;border-radius:8px;">
        <h2 style="color:#172B4D;margin-bottom:8px;">Password Reset</h2>
        <p style="color:#6B778C;margin-bottom:24px;">
          Use the code below to reset your BookStore admin password.<br/>
          It expires in <strong>15 minutes</strong>.
        </p>
        <div style="background:#fff;border:2px solid #0052CC;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <p style="color:#6B778C;font-size:12px;margin:0 0 6px;">Your reset code</p>
          <p style="font-size:36px;font-weight:900;letter-spacing:10px;color:#0052CC;margin:0;">${otp}</p>
        </div>
        <p style="color:#97A0AF;font-size:12px;">
          Go to the <strong>Forgot Password</strong> page, enter this code along with your new password.<br/><br/>
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

module.exports = { sendPasswordResetEmail }

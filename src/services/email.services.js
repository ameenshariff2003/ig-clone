const nodemailer = require("nodemailer")
const config = require("../config/config")

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: config.EMAIL_USER,
    pass: config.EMAIL_PASS, // app password not real password
  },
})

// verify on startup
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email service error:", error.message)
  } else {
    console.log("✅ Email service is active and ready to send!")
  }
})

// same signature — no changes needed in any other file
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Black Valley" <${config.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    })
    console.log("✅ Email sent:", info.messageId)
    return info
  } catch (error) {
    console.error("❌ Email error:", error.message)
    throw error
  }
}

module.exports = sendEmail
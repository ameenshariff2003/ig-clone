require("dotenv").config()

if(!process.env.EMAIL_USER) throw new Error("EMAIL_USER not found")
if(!process.env.EMAIL_PASS) throw new Error("EMAIL_PASS not found")

const config = {
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
}

module.exports = config
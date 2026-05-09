const twilio = require("twilio");

// ─── Twilio Client ─────────────────────────────────────────────────────────────
// Required env vars:
//   TWILIO_ACCOUNT_SID   – your Account SID (starts with AC…)
//   TWILIO_AUTH_TOKEN    – your Auth Token
//   TWILIO_FROM_NUMBER   – your Twilio phone number in E.164 format (+1xxxxxxxxxx)
//                          OR a Messaging Service SID (starts with MG…)

const getClient = () => {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error(
      "Missing Twilio credentials. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
    );
  }

  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
};

/**
 * Send an OTP via SMS using Twilio.
 *
 * @param {string} to   - Recipient phone number in E.164 format (e.g. +919876543210)
 * @param {string} otp  - The plain-text OTP to deliver
 * @returns {Promise<object>} Twilio message resource
 */
const sendSmsOtp = async (to, otp) => {
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!from) {
    throw new Error(
      "Missing TWILIO_FROM_NUMBER. Set it to your Twilio number or Messaging Service SID."
    );
  }

  const client = getClient();

  const messageOptions = {
    body: `Your verification code is ${otp}. It expires in 10 minutes. Do not share it with anyone.`,
    to,
  };

  // Support both a plain phone number and a Messaging Service SID (MG…)
  if (from.startsWith("MG")) {
    messageOptions.messagingServiceSid = from;
  } else {
    messageOptions.from = from;
  }

  try {
    const message = await client.messages.create(messageOptions);
    console.info(`[SMS] OTP sent to ${to} | SID: ${message.sid}`);
    return message;
  } catch (err) {
    console.error(`[SMS] Failed to send OTP to ${to}:`, err.message);
    throw err;
  }
};

module.exports = { sendSmsOtp }; 
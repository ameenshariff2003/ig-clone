const generateOtp=()=>{
  return Math.floor(100000+Math.random()*900000).toString();
}

const getOtp = (otp)=>{

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>OTP Verification</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px;">
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table width="400" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; padding:30px; box-shadow:0 5px 20px rgba(0,0,0,0.05);">

          <!-- Logo / Title -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <h2 style="margin:0; color:#333;">Your Company</h2>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td align="center" style="padding-bottom:10px;">
              <h3 style="margin:0; color:#111;">Verify Your Email</h3>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <p style="margin:0; color:#555; font-size:14px;">
                Use the OTP below to complete your verification.  
                This code is valid for 5 minutes.
              </p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td align="center" style="padding:20px 0;">
              <div style="
                display:inline-block;
                padding:15px 25px;
                font-size:24px;
                letter-spacing:4px; 
                font-weight:bold;
                color:#ffffff;
                background:linear-gradient(135deg, #4f46e5, #6366f1);
                border-radius:8px;
              ">
                ${otp}
              </div>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td align="center" style="padding-top:10px;">
              <p style="margin:0; color:#888; font-size:12px;">
                If you didn’t request this, you can ignore this email.
              </p>
            </td>
          </tr>

        </table>

        <!-- Footer -->
        <table width="400" cellpadding="0" cellspacing="0" style="margin-top:15px;">
          <tr>
            <td align="center">
              <p style="font-size:12px; color:#aaa;">
                © 2026 Your Company. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`

}

module.exports = {generateOtp,getOtp}
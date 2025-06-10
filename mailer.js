
const nodemailer = require("nodemailer");
require("dotenv").config(); // Load .env variables

const transporter = nodemailer.createTransport({
  service: "gmail", // Or your email service provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Define sendMail function before exporting
const sendMail = async (options) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER, 
      ...options,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (err) {
    console.error("Error sending email:", err);
  }
};

module.exports = sendMail;

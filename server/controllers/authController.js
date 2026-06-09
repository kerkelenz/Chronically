const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { Resend } = require("resend");
const User = require("../models/User");

const resend = new Resend(process.env.RESEND_API_KEY);

// bcrypt recommends 10 salt rounds as a good balance between security and performance
// the higher the number the slower the hash - which is actually intentional to slow down hackers
const SALT_ROUNDS = 10;

// register handles creating a new user account
const register = async (req, res) => {
  try {
    // pulling the fields out of the request body that the frontend sends us
    const { username, email, password } = req.body;

    // basic validation - make sure nothing is missing before we do anything else
    if (!username || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // check if someone already signed up with this email
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // never store plain text passwords - bcrypt turns it into a hash that can't be reversed
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    await resend.emails.send({
      from: "Chronically <noreply@mychronically.app>",
      to: email,
      subject: "Verify your Chronically account",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2D2540; font-family: Georgia, serif;">Welcome to Chronically</h2>
          <p style="color: #6B5F7A;">Thanks for signing up, ${username}. Click the button below to verify your email address.</p>
          <a href="${verifyUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #7C6BAE; color: white; border-radius: 999px; text-decoration: none; font-size: 14px;">Verify Email</a>
          <p style="color: #6B5F7A; font-size: 12px; margin-top: 24px;">If you didn't create this account, you can safely ignore this email.</p>
        </div>
      `,
    });

    res.status(201).json({
      message:
        "Account created. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Server error during registration" });
  }
};

// login handles checking credentials and returning a token if they're valid
const login = async (req, res) => {
  try {
    // login only needs email and password - username isn't required here
    const { email, password } = req.body;

    // make sure both fields were actually sent
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: "Please verify your email before logging in." });
    }

    // password checks out - generate a fresh JWT token for this session
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    // send back the token and user info so the frontend can store it and use it
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    const user = await User.findOne({ where: { verificationToken: token } });
    if (!user)
      return res
        .status(400)
        .json({ error: "Invalid or expired verification link" });

    const updates = { isVerified: true, verificationToken: null };
    if (user.pendingEmail) {
      updates.email = user.pendingEmail;
      updates.pendingEmail = null;
    }
    await User.update(updates, { where: { id: user.id } });

    const jwtToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    res.status(200).json({
      message: "Email verified successfully",
      token: jwtToken,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // return success regardless to prevent email enumeration
      return res.status(200).json({
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.update({ resetToken: token, resetTokenExpiry: expiry });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await resend.emails.send({
      from: "Chronically <noreply@mychronically.app>",
      to: email,
      subject: "Reset your Chronically password",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2D2540; font-family: Georgia, serif;">Password Reset</h2>
          <p style="color: #6B5F7A;">We received a request to reset your Chronically password. Click the button below — the link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #7C6BAE; color: white; border-radius: 999px; text-decoration: none; font-size: 14px;">Reset Password</a>
          <p style="color: #6B5F7A; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    await User.update(
      { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
      { where: { id: user.id } },
    );

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const validateResetToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    const user = await User.findOne({
      where: {
        resetToken: token,
        resetTokenExpiry: { [Op.gt]: new Date() },
      },
    });

    if (!user) return res.status(400).json({ error: "Invalid or expired reset link" });

    res.status(200).json({ valid: true });
  } catch (error) {
    console.error("Validate reset token error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  validateResetToken,
};

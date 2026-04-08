const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../utils/emailService');

const isResendTestingRestrictionError = (error) => {
  const message =
    (error && error.response && error.response.data && error.response.data.message) ||
    (error && error.message) ||
    '';
  return typeof message === 'string' && message.includes('You can only send testing emails to your own email address');
};

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Register user
exports.register = async (req, res, next) => {
  try {
    const { firstName, lastName, mobile, dob, password } = req.body;
    const email = normalizeEmail(req.body.email);
    
    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { mobile }] });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or mobile already exists'
      });
    }
    
    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      mobile,
      dob,
      password
    });
    
    // Generate OTP
    const otp = user.generateOTP();
    await user.save();
    
    // Local/test bypass for environments where email credentials are unavailable
    const isDev = process.env.NODE_ENV === 'development';
    const bypassEmail = process.env.DEV_OTP_BYPASS === 'true';

    if (bypassEmail) {
      console.log('OTP BYPASS MODE: Skipping verification email');
      console.log(`OTP for ${email}: ${otp}`);
      
      return res.status(201).json({
        success: true,
        message: 'Registration successful! [BYPASS MODE] Check server console for OTP.',
        devMode: true,
        devOtp: otp
      });
    }
    
    // Create HTML template for OTP email
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4073c0;">ChittSaathi</h1>
        </div>
        <div style="margin-bottom: 30px;">
          <h2 style="color: #333;">Verify Your Account</h2>
          <p>Thank you for registering with ChittSaathi. To complete your registration, please use the following OTP code:</p>
          <div style="background-color: #f5f7fa; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0; font-weight: bold; color: #4073c0;">
            ${otp}
          </div>
          <p>This code is valid for 10 minutes and can only be used once.</p>
        </div>
        <div style="color: #666; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          <p>If you didn't request this email, please ignore it.</p>
          <p>© ${new Date().getFullYear()} ChittSaathi. All rights reserved.</p>
        </div>
      </div>
    `;
    
    try {
      // Send OTP via email
      const emailResult = await sendEmail({
        to: email,
        subject: 'ChittSaathi Account Verification',
        text: `Your verification OTP is: ${otp}. This OTP is valid for 10 minutes.`,
        html: htmlContent
      });
      
      if (!emailResult.success) {
        // Email failed to send
        console.error('Failed to send verification email:', emailResult.error);

        if (isResendTestingRestrictionError(emailResult.error)) {
          console.warn('Resend test-mode restriction detected. Returning OTP for local verification flow.');
          console.log(`OTP for ${email}: ${otp}`);

          return res.status(201).json({
            success: true,
            message: 'Registration successful in test mode. Verify your sender domain in Resend to email all users. OTP is returned for now.',
            devMode: true,
            devOtp: otp
          });
        }
        
        // In local/dev-like mode, proceed anyway but with a warning
        if (isDev || bypassEmail) {
          console.warn('BYPASS/DEV MODE: Proceeding with registration despite email failure');
          console.log(`OTP for ${email}: ${otp}`);
          
          return res.status(201).json({
            success: true,
            message: 'Registration successful! Email sending failed, but OTP is in server logs.',
            devMode: true,
            devOtp: otp
          });
        }
        
        // In production, clean up and return error
        await User.findByIdAndDelete(user._id);
        return res.status(500).json({
          success: false,
          message: 'Registration failed: Could not send verification email. Please try again later.'
        });
      }
      
      // Email sent successfully
      res.status(201).json({
        success: true,
        message: 'Registration successful! Please verify your account with the OTP sent to your email.'
      });
      
    } catch (error) {
      console.error('Email error:', error);
      
      // Clean up user on email error
      await User.findByIdAndDelete(user._id);
      
      return res.status(500).json({
        success: false,
        message: 'Registration failed: Email service error. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

// Verify OTP
exports.verifyOTP = async (req, res, next) => {
  try {
    const otp = req.body.otp;
    const email = normalizeEmail(req.body.email);
    
    // Hash the received OTP
    const hashedOTP = crypto
      .createHash('sha256')
      .update(otp)
      .digest('hex');
    
    // Find user with matching OTP and valid expiry
    const user = await User.findOne({
      email,
      verificationToken: hashedOTP,
      verificationExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }
    
    // Mark user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    await user.save();
    
    // Generate token and send response
    const token = generateToken(user._id);
    
    res.status(200).json({
      success: true,
      message: 'Account verified successfully',
      token
    });
  } catch (error) {
    next(error);
  }
};

// Resend OTP
exports.resendOTP = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Account already verified'
      });
    }
    
    // Generate new OTP
    const otp = user.generateOTP();
    await user.save();
    
    const bypassEmail = process.env.DEV_OTP_BYPASS === 'true';

    if (bypassEmail) {
      console.log('OTP BYPASS MODE: Resend OTP without email');
      console.log(`OTP for ${email}: ${otp}`);

      return res.status(200).json({
        success: true,
        message: 'New OTP generated. Check server logs.',
        devMode: true,
        devOtp: otp
      });
    }

    // Send OTP via email
    try {
      const emailResult = await sendEmail({
        to: email,
        subject: 'ChittSaathi Account Verification - New OTP',
        text: `Your new verification OTP is: ${otp}. This OTP is valid for 10 minutes.`
      });

      if (!emailResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Could not send verification email. Please check email provider settings.'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'New OTP sent successfully'
      });
    } catch (error) {
      if (isResendTestingRestrictionError(error)) {
        console.warn('Resend test-mode restriction detected while resending OTP. Returning OTP directly.');
        console.log(`OTP for ${email}: ${otp}`);

        return res.status(200).json({
          success: true,
          message: 'OTP regenerated in test mode. Verify sender domain in Resend to email all users.',
          devMode: true,
          devOtp: otp
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Could not send verification email'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    
    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      // Generate new OTP
      const otp = user.generateOTP();
      await user.save();
      
      const bypassEmail = process.env.DEV_OTP_BYPASS === 'true';

      if (bypassEmail) {
        console.log('OTP BYPASS MODE: Login blocked until verification, OTP in logs');
        console.log(`OTP for ${email}: ${otp}`);

        return res.status(401).json({
          success: false,
          message: 'Account not verified. Check server logs for OTP.',
          devMode: true,
          devOtp: otp
        });
      }

      try {
        // Send OTP via email
        const emailResult = await sendEmail({
          to: email,
          subject: 'ChittSaathi Account Verification',
          text: `Your verification OTP is: ${otp}. This OTP is valid for 10 minutes.`
        });

        if (!emailResult.success) {
          return res.status(500).json({
            success: false,
            message: 'Could not send verification email. Please check email provider settings.'
          });
        }

        return res.status(401).json({
          success: false,
          message: 'Account not verified. A new OTP has been sent to your email.'
        });
      } catch (error) {
        if (isResendTestingRestrictionError(error)) {
          console.warn('Resend test-mode restriction detected during login OTP send. Returning OTP directly.');
          console.log(`OTP for ${email}: ${otp}`);

          return res.status(401).json({
            success: false,
            message: 'Account not verified. OTP returned in test mode.',
            devMode: true,
            devOtp: otp
          });
        }

        throw error;
      }
    }
    
    // Generate token and send response
    const token = generateToken(user._id);
    
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account with that email address exists'
      });
    }
    
    // Generate reset token
    const resetToken = user.getResetPasswordToken();
    await user.save();
    
    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    
    // Send email
    try {
      const emailResult = await sendEmail({
        to: email,
        subject: 'ChittSaathi Password Reset',
        text: `You requested a password reset. Please go to this link to reset your password: ${resetUrl}
        
        If you didn't request this, please ignore this email.`
      });

      if (!emailResult.success) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        return res.status(500).json({
          success: false,
          message: 'Could not send reset email. Please check email provider settings.'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Password reset link sent to your email'
      });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();
      
      return res.status(500).json({
        success: false,
        message: 'Could not send reset email'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');
    
    // Find user with token
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};

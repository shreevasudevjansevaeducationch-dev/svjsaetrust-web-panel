"use client";
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { AiOutlineMail, AiOutlineLock, AiOutlineSafety } from 'react-icons/ai';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from 'next/navigation';
import { getDeviceInfo } from '@/lib/commonFun';
import { doc, setDoc } from 'firebase/firestore';

const { Title } = Typography;

const OTP_TIMEOUT = 60; // 60 seconds = 1 minute
const OTP_VALIDITY_DAYS = 7; // 7 days validity
const OTP_STORAGE_KEY = 'lastOtpVerification';

// Helper functions for localStorage
const getLastVerification = (email) => {
  try {
    const stored = localStorage.getItem(OTP_STORAGE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    return data[email] || null;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
};

const setLastVerification = (email) => {
  try {
    const stored = localStorage.getItem(OTP_STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    
    data[email] = new Date().toISOString();
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};

const needsOTPVerification = (email) => {
  const lastVerified = getLastVerification(email);
  if (!lastVerified) return true;
  
  const lastDate = new Date(lastVerified);
  const now = new Date();
  const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);
  return diffDays >= OTP_VALIDITY_DAYS;
};

async function saveSession(userId, sessionToken) {
  const deviceInfo = getDeviceInfo();
  const ipRes = await fetch("https://ipapi.co/json/");
  const locationData = await ipRes.json();

  const session = {
    ip: locationData.ip,
    location: `${locationData.city}, ${locationData.region}, ${locationData.country_name}`,
    pinCode:locationData.postal,
    device: deviceInfo.device,
    os: deviceInfo.os,
    browser: deviceInfo.browser,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    sessionToken,
  };

  await setDoc(doc(db, "users", userId, "sessions", sessionToken), session);
}

const LoginPage = () => {
    const { message } = App.useApp();
  const [step, setStep] = useState(1); // 1: email, 2: otp, 3: password
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);
const router=useRouter()
  function generateSessionToken() {
    return "sess_" + crypto.randomUUID();
  }
  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (countdown === 0 && step === 2) {
      setCanResend(true);
    }
  }, [countdown, step]);

  // Step 1: Email form submit
  const onFinishEmail = async (values) => {
    setLoading(true);
    setEmail(values.email);

    try {
      // 1. Check if email exists
      const res = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkEmail", email: values.email }),
      });
      const data = await res.json();

      if (!data.exists) {
        setLoading(false);
        message.error("This email is not registered.");
        return;
      }

      // 2. Check if OTP verification is needed
      if (needsOTPVerification(values.email)) {
        // Send OTP if verification needed
        const otpRes = await fetch("/api/opt-send-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", email: values.email }),
        });
        
        if (otpRes.ok) {
          message.success("OTP sent to your email!");
          setStep(2);
          setCountdown(OTP_TIMEOUT);
          setCanResend(false);
        } else {
          const otpData = await otpRes.json();
          message.error(otpData.error || "Failed to send OTP. Please try again.");
        }
      } else {
        // Skip OTP verification if not needed
        setStep(3); // Go directly to password step
        message.info("Please enter your password to continue.");
      }
    } catch (error) {
      message.error("An error occurred. Please try again.");
    }
    
    setLoading(false);
  };

  // Step 2: OTP form submit
  const onFinishOtp = async (values) => {
    setLoading(true);
    setOtp(values.otp);

    try {
      const verifyRes = await fetch("/api/opt-send-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email, otp: values.otp }),
      });
      
      if (verifyRes.ok) {
        setLastVerification(email); // Store verification timestamp in localStorage
        message.success("OTP verified! Please enter your password.");
        setStep(3);
      } else {
        message.error("OTP verification failed.");
      }
    } catch (error) {
      message.error("An error occurred during verification.");
    }
    
    setLoading(false);
  };

  // Step 3: Password form submit
  const onFinishPassword = async (values) => {
    setLoading(true);

    if (!values.password || values.password.length < 6) {
      setLoading(false);
      message.error("Invalid password.");
      return;
    }

    try {
      // Firebase login
      const userCredential = await signInWithEmailAndPassword(auth, email, values.password);
      const user = userCredential.user;

      let sessionToken = localStorage.getItem("session_token") 

      // Save session info
      if (!sessionToken) {
        sessionToken = generateSessionToken();
        localStorage.setItem("session_token", sessionToken);
      }

      await saveSession(user.uid, sessionToken);

      message.success("Login Successful!");
      window.location.href = "/";
    } catch (error) {
      message.error(error.message || "Login failed.");
    }
    setLoading(false);
  };

  // Forgot password handler
  const handleForgotPassword = async () => {
    try {
      if (!email) {
        message.error("Please enter your email first");
        setStep(1);
        return;
      }

      await sendPasswordResetEmail(auth, email);
      message.success(
        "Password reset link sent! Please check your email inbox."
      );
    } catch (error) {
      console.error("Password reset error:", error);
      message.error(
        error.message || "Failed to send reset link. Please try again."
      );
    }
  };

  // Resend OTP handler
  const handleResendOTP = async () => {
    setLoading(true);
    const otpRes = await fetch("/api/opt-send-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", email }),
    });

    if (otpRes.ok) {
      message.success("New OTP sent!");
      setCountdown(OTP_TIMEOUT);
      setCanResend(false);
    } else {
      const otpData = await otpRes.json();
      message.error(otpData.error || "Failed to resend OTP.");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: `linear-gradient(145deg, 
          var(--primary-light) 0%, 
          var(--background) 100%)`
      }}
    >
      <Card
        className="w-full max-w-md shadow-lg fade-in"
        style={{ borderRadius: 12 }}
      >
        <Title level={3} className="text-center mb-6" style={{ color: 'var(--primary-blue)' }}>
          Login
        </Title>
        {step === 1 && (
          <Form
            layout="vertical"
            onFinish={onFinishEmail}
            requiredMark={false}
            autoComplete="off"
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Invalid email address' },
              ]}
            >
              <Input
                prefix={<AiOutlineMail className="text-[var(--primary-dark)]" />}
                placeholder="you@example.com"
                size="large"
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{
                  background: 'var(--primary-blue)',
                  borderColor: 'var(--primary-blue)',
                  fontWeight: 600,
                  borderRadius: 6,
                }}
              >
                Send OTP
              </Button>
            </Form.Item>
          </Form>
        )}
        {step === 2 && (
          <Form
            layout="vertical"
            onFinish={onFinishOtp}
            requiredMark={false}
            autoComplete="off"
          >
            <Form.Item
              label={
                <div className="flex justify-between items-center w-full">
                  <span>Enter OTP sent to your email</span>
                  <span className="text-sm text-gray-500">
                    {countdown > 0 ? `${countdown}s` : "OTP expired"}
                  </span>
                </div>
              }
              name="otp"
              rules={[
                { required: true, message: 'Please enter the OTP' },
                { len: 6, message: 'OTP must be 6 digits' },
              ]}
            >
              <Input
                prefix={<AiOutlineSafety className="text-[var(--primary-dark)]" />}
                placeholder="6-digit OTP"
                maxLength={6}
                size="large"
              />
            </Form.Item>
            
            <div className="flex justify-between items-center mb-4">
              <Button
                type="link"
                disabled={!canResend}
                onClick={handleResendOTP}
                className={`p-0 h-auto ${!canResend ? 'opacity-50' : ''}`}
              >
                Resend OTP
              </Button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-[var(--primary-blue)] hover:underline text-sm font-medium bg-transparent border-none p-0"
              >
                Change Email
              </button>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{
                  background: 'var(--primary-blue)',
                  borderColor: 'var(--primary-blue)',
                  fontWeight: 600,
                  borderRadius: 6,
                }}
              >
                Verify OTP
              </Button>
            </Form.Item>
          </Form>
        )}
        {step === 3 && (
          <Form
            layout="vertical"
            onFinish={onFinishPassword}
            requiredMark={false}
            autoComplete="off"
          >
            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: 'Please enter your password' },
                { min: 6, message: 'Password must be at least 6 characters' },
              ]}
            >
              <Input.Password
                prefix={<AiOutlineLock className="text-[var(--primary-dark)]" />}
                placeholder="Password"
                size="large"
              />
            </Form.Item>
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[var(--primary-blue)] hover:underline text-sm font-medium bg-transparent border-none p-0"
                style={{ cursor: 'pointer' }}
              >
                Forgot Password?
              </button>
            </div>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{
                  background: 'var(--primary-blue)',
                  borderColor: 'var(--primary-blue)',
                  fontWeight: 600,
                  borderRadius: 6,
                }}
              >
                Login
              </Button>
            </Form.Item>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default LoginPage;
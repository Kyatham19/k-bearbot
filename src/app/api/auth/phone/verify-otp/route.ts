import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/auth/phone/verify-otp
 * Verify OTP and sign in user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { phoneNumber, otp } = await request.json();

    if (!phoneNumber || !otp) {
      return NextResponse.json(
        { error: "Phone number and OTP are required" },
        { status: 400 }
      );
    }

    // Verify OTP with Twilio
    const verificationCheck = await twilioClient.verify.v2
      .services(process.env.TWILIO_VERIFY_SID!)
      .verificationChecks.create({
        to: phoneNumber,
        code: otp,
      });

    if (verificationCheck.status !== "approved") {
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      );
    }

    // Check if user exists with this phone number
    // For now, we'll create a dummy email based on phone number
    // In production, you'd have a proper user mapping
    const dummyEmail = `${phoneNumber.replace('+', '')}@phone.local`;

    // Try to sign in with the dummy email
    // If user doesn't exist, Supabase will return an error
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: dummyEmail,
      password: phoneNumber, // Using phone number as password for demo
    });

    if (signInError) {
      // If user doesn't exist, create one
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: dummyEmail,
        password: phoneNumber,
        options: {
          data: {
            phone_number: phoneNumber,
          }
        }
      });

      if (signUpError) {
        return NextResponse.json(
          { error: "Failed to create account" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Account created successfully. Please check your email to verify.",
        needsEmailVerification: true
      });
    }

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: data.user
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
import Razorpay from "razorpay";

export const RAZORPAY_ENABLED = process.env.RAZORPAY_ENABLED === "true";

let razorpayInstance: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!RAZORPAY_ENABLED) {
    throw new Error("Razorpay is not enabled. Set RAZORPAY_ENABLED=true when ready to go live.");
  }
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars.");
  }
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

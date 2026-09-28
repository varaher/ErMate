import {
  Request,
  Response,
  NextFunction
} from "express";

import { adminAuth } from "../lib/firebase-admin";

import type {
  DecodedIdToken
} from "firebase-admin/auth";


export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}


/**
 * Extract a Firebase Bearer token safely.
 */
function getBearerToken(
  authHeader?: string
): string | null {
  if (!authHeader) {
    return null;
  }

  const match =
    authHeader.match(/^Bearer\s+(.+)$/i);

  const token =
    match?.[1]?.trim();

  return token || null;
}


/**
 * Standard authentication middleware.
 *
 * Confirms that the request contains a valid
 * Firebase ID token and exposes the verified
 * Firebase identity through req.user.
 *
 * This middleware authenticates identity only.
 * It intentionally does NOT require email
 * verification globally.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token =
    getBearerToken(
      req.headers.authorization
    );

  if (!token) {
    return res.status(401).json({
      error:
        "Unauthorized: Missing or invalid authentication token."
    });
  }

  try {
    const decodedToken =
      await adminAuth.verifyIdToken(token);

    req.user = decodedToken;

    return next();
  } catch (error) {
    console.error(
      "Error verifying Firebase ID token:",
      error
    );

    return res.status(401).json({
      error:
        "Unauthorized: Invalid or expired authentication token."
    });
  }
};


/**
 * Use AFTER requireAuth for operations where
 * ownership of the email address must be proven.
 *
 * Examples:
 * - accepting an email-restricted team invitation
 * - privileged account actions
 *
 * Do not apply this globally until the frontend
 * email-verification UX has been completed.
 */
export const requireVerifiedEmail = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      error:
        "Unauthorized: Authentication is required."
    });
  }

  const email =
    String(req.user.email || "")
      .trim()
      .toLowerCase();

  if (
    !email ||
    req.user.email_verified !== true
  ) {
    return res.status(403).json({
      error:
        "Please verify your email address before continuing."
    });
  }

  return next();
};
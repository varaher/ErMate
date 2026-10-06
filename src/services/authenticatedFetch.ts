/**
 * ErMate — Shared Authenticated Fetch Helper
 *
 * Ensures all protected API calls send a valid Firebase ID token via Authorization: Bearer <token>.
 *
 * Invariants:
 * 1. Checks auth.currentUser; if not authenticated, throws a friendly authentication error
 *    without raw 401 exposure or technical stack traces.
 * 2. Attaches Authorization: Bearer <idToken> to every request.
 * 3. Preserves existing request options (headers, method, body, signal).
 */

import { auth } from "../firebase";

export class AuthRequiredError extends Error {
  constructor(message = "Your session needs to be refreshed. Please sign in again.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new AuthRequiredError();
  }

  const idToken = await currentUser.getIdToken();
  if (!idToken) {
    throw new AuthRequiredError();
  }

  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${idToken}`);

  return fetch(input, {
    ...init,
    headers,
  });
}

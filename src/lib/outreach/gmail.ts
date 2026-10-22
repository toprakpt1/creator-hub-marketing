import "server-only";
import {
  getMailAccount,
  markMailAccountError,
  updateMailAccessToken,
} from "@/lib/db/mail";
import { buildRawMessage } from "@/lib/outreach/mime";

/**
 * Gmail over Google OAuth2.
 *
 * We talk to the REST endpoints directly instead of pulling in `googleapis`:
 * three fetches (authorize, token, send) is the whole surface we need.
 *
 * Scope is deliberately narrow — `gmail.send` can send, not read the inbox.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.send",
];

/** Refresh this many ms before the token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

export type GmailErrorCode =
  | "not_configured"
  | "needs_reconnect"
  | "forbidden"
  | "rate_limited"
  | "send_failed";

export class GmailError extends Error {
  constructor(message: string, readonly code: GmailErrorCode) {
    super(message);
    this.name = "GmailError";
  }
}

export function oauthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
}

function clientCredentials() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new GmailError(
      "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are missing from .env.",
      "not_configured"
    );
  }
  return { clientId, clientSecret };
}

/**
 * The exact URI sent at authorize time must be repeated at token time, so both
 * the connect route and the callback derive it from here.
 */
export function resolveRedirectUri(requestUrl: string): string {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return new URL("/api/mail/gmail/callback", requestUrl).toString();
}

export function buildAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = clientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    // offline + consent is what guarantees a refresh token comes back.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleErrorBody {
  error?: string;
  error_description?: string;
}

async function readGoogleError(response: Response): Promise<GoogleErrorBody> {
  try {
    return (await response.json()) as GoogleErrorBody;
  } catch {
    return {};
  }
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ email: string; tokens: TokenResponse }> {
  const { clientId, clientSecret } = clientCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const body = await readGoogleError(response);
    throw new GmailError(
      body.error_description || body.error || "Google rejected the authorization code.",
      "needs_reconnect"
    );
  }

  const tokens = (await response.json()) as TokenResponse;
  if (!tokens.refresh_token) {
    throw new GmailError(
      "Google did not return a refresh token. Remove the app's access at myaccount.google.com/permissions and connect again.",
      "needs_reconnect"
    );
  }

  const profile = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profile.ok) {
    throw new GmailError("Could not read the Google account address.", "needs_reconnect");
  }
  const { email } = (await profile.json()) as { email?: string };
  if (!email) {
    throw new GmailError("Google did not return an email address.", "needs_reconnect");
  }

  return { email, tokens };
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = clientCredentials();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await readGoogleError(response);
    if (body.error === "invalid_grant") {
      const message =
        "Google no longer accepts this connection (it was revoked or expired). Connect Gmail again.";
      markMailAccountError(message);
      throw new GmailError(message, "needs_reconnect");
    }
    throw new GmailError(
      body.error_description || body.error || "Could not refresh the Google token.",
      "send_failed"
    );
  }

  return (await response.json()) as TokenResponse;
}

/** A usable access token, refreshing and persisting it when needed. */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const account = getMailAccount();
  if (!account) {
    throw new GmailError("No Gmail account is connected.", "not_configured");
  }

  const stillValid =
    !forceRefresh &&
    account.accessToken &&
    account.accessTokenExpiresAt !== null &&
    account.accessTokenExpiresAt - EXPIRY_MARGIN_MS > Date.now();

  if (stillValid) return account.accessToken as string;

  const tokens = await refreshAccessToken(account.refreshToken);
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  updateMailAccessToken(tokens.access_token, expiresAt);
  return tokens.access_token;
}

export interface GmailSendResult {
  messageId: string;
}

export async function sendViaGmail(input: {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}): Promise<GmailSendResult> {
  const raw = await buildRawMessage(input);

  const post = (token: string) =>
    fetch(SEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

  let response = await post(await getAccessToken());

  // A token revoked between our check and the call: refresh once, then give up.
  if (response.status === 401) {
    response = await post(await getAccessToken(true));
  }

  if (response.ok) {
    const body = (await response.json()) as { id?: string };
    return { messageId: body.id ?? "" };
  }

  const body = await readGoogleError(response);
  const reason = body.error_description || body.error || `HTTP ${response.status}`;

  if (response.status === 401) {
    const message = "Google rejected the connection. Connect Gmail again.";
    markMailAccountError(message);
    throw new GmailError(message, "needs_reconnect");
  }
  if (response.status === 403) {
    throw new GmailError(
      `Gmail refused to send (${reason}). The account may have hit its daily limit or the send scope was not granted.`,
      "forbidden"
    );
  }
  if (response.status === 429) {
    throw new GmailError("Gmail rate limit reached. Try again later.", "rate_limited");
  }

  throw new GmailError(`Gmail could not send the message: ${reason}`, "send_failed");
}

/** Refreshes the token; a successful refresh proves the grant is still valid. */
export async function verifyGmail(): Promise<void> {
  const account = getMailAccount();
  if (!account) {
    throw new GmailError("No Gmail account is connected.", "not_configured");
  }
  await getAccessToken(true);
}

/** Best effort: revoke at Google so removing the row really disconnects. */
export async function revokeGmail(): Promise<void> {
  const account = getMailAccount();
  if (!account) return;
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(account.refreshToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {
    // A failed revoke must not leave a half-deleted local account behind.
  }
}

import { ApiError } from "./errors";

/**
 * Checking a "Sign in with Google" token sent by a mobile app.
 *
 * The app signs the person in with Google on the phone and gets an ID token. The server never trusts it as it arrives: Google
 * itself is asked whether it issued the token (tokeninfo), and the answer must say it was issued for one of OUR apps' client IDs,
 * has not expired, and belongs to an email address Google has verified. Only then is the email used to find or create the account.
 */

/** The Google web client ID the apps ask tokens for. A client ID is public (it is inside the app); the secret is never used here. */
export const GOOGLE_MOBILE_CLIENT_ID = "697904571198-9a8o0temavlhoameofilrna6q0ira1e5.apps.googleusercontent.com";

export interface GoogleIdentity {
  email: string;
  name: string | null;
  picture: string | null;
  subject: string;
}

function allowedAudiences(): string[] {
  const extra = (process.env.GOOGLE_MOBILE_CLIENT_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [GOOGLE_MOBILE_CLIENT_ID, ...extra];
}

type Fetcher = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export async function verifyGoogleIdToken(idToken: string, opts: { fetcher?: Fetcher; nowMs?: number; audiences?: string[] } = {}): Promise<GoogleIdentity> {
  const fetcher = opts.fetcher ?? ((url: string) => fetch(url, { cache: "no-store" }));
  const nowMs = opts.nowMs ?? Date.now();
  const audiences = opts.audiences ?? allowedAudiences();
  const invalid = () => new ApiError("UNAUTHENTICATED", "Google sign-in could not be confirmed. Try again.");

  let info: Record<string, unknown>;
  try {
    const res = await fetcher(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) throw invalid();
    info = (await res.json()) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("UNAVAILABLE", "Google sign-in is not available right now. Try again shortly.");
  }

  const aud = typeof info.aud === "string" ? info.aud : "";
  const iss = typeof info.iss === "string" ? info.iss : "";
  const exp = Number(info.exp);
  const email = typeof info.email === "string" ? info.email.trim().toLowerCase() : "";
  const verified = info.email_verified === true || info.email_verified === "true";
  if (!audiences.includes(aud)) throw invalid();
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") throw invalid();
  if (!Number.isFinite(exp) || exp * 1000 <= nowMs) throw invalid();
  if (!email || !verified) throw invalid();

  return {
    email,
    name: typeof info.name === "string" && info.name.trim() ? info.name.trim().slice(0, 120) : null,
    picture: typeof info.picture === "string" && info.picture.startsWith("https://") ? info.picture : null,
    subject: typeof info.sub === "string" ? info.sub : "",
  };
}

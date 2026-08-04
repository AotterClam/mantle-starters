import {
  createAuth,
  createSetupIncompleteAuth,
  type Auth,
  type MantleCloudflareEnv,
} from "@aotter/mantle/cloudflare";

export interface MantleSiteAuthEnv extends MantleCloudflareEnv {
  readonly MANTLE_AUTH_MODE?: string;
  readonly MANTLE_HOSTED_AUTH_ISSUER?: string;
  readonly MANTLE_HOSTED_AUTH_CLIENT_ID?: string;
}

export function buildAuth(env: MantleSiteAuthEnv): Auth {
  const mode = value(env.MANTLE_AUTH_MODE);
  const secret = value(env.BETTER_AUTH_SECRET);
  const owner = githubLogin(env.ADMIN_GITHUB_LOGIN);
  const hostedIssuerRaw = value(env.MANTLE_HOSTED_AUTH_ISSUER);
  const hostedClientIdRaw = value(env.MANTLE_HOSTED_AUTH_CLIENT_ID);
  const hostedIssuer = hostedOrigin(hostedIssuerRaw);
  const hostedClientId = hostedClient(hostedClientIdRaw, hostedIssuer);
  const githubClientId = value(env.GITHUB_CLIENT_ID);
  const githubClientSecret = value(env.GITHUB_CLIENT_SECRET);
  const baseURL = value(env.PUBLIC_ORIGIN)?.replace(/\/+$/, "") ?? "http://localhost:8787";

  if (mode === "hosted") {
    if (!secret || !owner || !hostedIssuer || !hostedClientId || githubClientId || githubClientSecret) {
      return incomplete("Hosted Auth is incomplete or conflicts with self-managed GitHub credentials.");
    }
    return createAuth({
      database: env.DB,
      baseURL,
      secret,
      methods: [{
        kind: "oauth",
        providerId: "github",
        displayName: "GitHub",
        clientId: hostedClientId,
        authorizationUrl: `${hostedIssuer}/authorize`,
        tokenUrl: `${hostedIssuer}/token`,
        userInfoUrl: `${hostedIssuer}/userinfo`,
        scopes: ["profile", "email"],
        redirectURI: `${baseURL}/api/auth/oauth2/callback/github`,
        pkce: true,
        mapProfileToUser: (profile) => {
          const login = githubLogin(profile.github_login);
          return login ? { githubLogin: login } : {};
        },
      }],
      bootstrapOwner: { match: "github-login", value: owner },
    });
  }

  if (mode === "self-managed") {
    if (!secret || !owner || !githubClientId || !githubClientSecret || hostedIssuerRaw || hostedClientIdRaw) {
      return incomplete("Self-managed Auth is incomplete or conflicts with Hosted Auth configuration.");
    }
    return createAuth({
      database: env.DB,
      baseURL,
      secret,
      methods: [{
        kind: "social",
        provider: "github",
        clientId: githubClientId,
        clientSecret: githubClientSecret,
      }],
      bootstrapOwner: { match: "github-login", value: owner },
    });
  }

  return incomplete("MANTLE_AUTH_MODE must be hosted or self-managed.");
}

function incomplete(message: string): Auth {
  return createSetupIncompleteAuth({ message });
}

function hostedOrigin(raw: string | null): string | null {
  try {
    const url = new URL(value(raw) ?? "");
    if (!secureOrLoopback(url) || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function hostedClient(raw: string | null, issuer: string | null): string | null {
  try {
    const url = new URL(value(raw) ?? "");
    return issuer && secureOrLoopback(url) && url.origin === issuer && /^\/clients\/[A-Za-z0-9_-]{1,128}$/u.test(url.pathname) && !url.search && !url.hash
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function secureOrLoopback(url: URL): boolean {
  return !url.username && !url.password && (url.protocol === "https:" || (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]")
  ));
}

function githubLogin(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u.test(raw.trim())
    ? raw.trim()
    : null;
}

function value(raw: string | null | undefined): string | null {
  return raw?.trim() || null;
}

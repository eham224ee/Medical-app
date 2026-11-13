import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpError } from './error.js';

const SESSION_COOKIE = 'medico_master_admin';
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const failedLogins = new Map<string, { count: number; resetAt: number }>();

function getSessionSecret(): string | undefined {
  const secret = process.env.MASTER_ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : undefined;
}

function compareSecret(provided: string, configured: string): boolean {
  const providedHash = createHash('sha256').update(provided).digest();
  const configuredHash = createHash('sha256').update(configured).digest();
  return timingSafeEqual(providedHash, configuredHash);
}

function cookieValue(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return undefined;

  try {
    return decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1));
  } catch {
    return undefined;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function validSession(cookie: string | undefined): boolean {
  const secret = getSessionSecret();
  if (!secret || !cookie) return false;
  const separator = cookie.lastIndexOf('.');
  if (separator <= 0) return false;

  const payload = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  const [version, issuedAtText] = payload.split(':');
  const issuedAt = Number(issuedAtText);
  const now = Math.floor(Date.now() / 1000);
  if (
    version !== 'v1' ||
    !Number.isInteger(issuedAt) ||
    issuedAt > now ||
    now - issuedAt > SESSION_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(sign(payload, secret), 'base64url');
  const actual = Buffer.from(signature, 'base64url');
  return (
    actual.length === expected.length && timingSafeEqual(expected, actual)
  );
}

export const requireMasterAdmin: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (!validSession(cookieValue(request.headers.cookie))) {
    next(new HttpError('Master admin authentication is required.', 401));
    return;
  }
  next();
};

export function createMasterAdminSession(): string {
  const secret = getSessionSecret();
  if (!secret) {
    throw new HttpError(
      'MASTER_ADMIN_SESSION_SECRET must be configured with at least 32 characters.',
      503,
    );
  }
  const payload = `v1:${Math.floor(Date.now() / 1000)}:${randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function validateMasterAdminCredentials(
  username: unknown,
  password: unknown,
  ipAddress: string,
): boolean {
  const now = Date.now();
  const attempts = failedLogins.get(ipAddress);
  if (attempts && attempts.resetAt <= now) failedLogins.delete(ipAddress);
  const current = failedLogins.get(ipAddress);
  if (current && current.count >= MAX_LOGIN_ATTEMPTS) return false;

  const configuredUsername = process.env.MASTER_ADMIN_USERNAME;
  const configuredPassword = process.env.MASTER_ADMIN_PASSWORD;
  const configured = Boolean(configuredUsername && configuredPassword);
  const usernameMatches = compareSecret(
    typeof username === 'string' ? username : '',
    configuredUsername ?? '',
  );
  const passwordMatches = compareSecret(
    typeof password === 'string' ? password : '',
    configuredPassword ?? '',
  );
  const valid =
    configured &&
    typeof username === 'string' &&
    typeof password === 'string' &&
    usernameMatches &&
    passwordMatches;

  if (valid) {
    failedLogins.delete(ipAddress);
    return true;
  }

  if (failedLogins.size > 1000) {
    for (const [ip, record] of failedLogins) {
      if (record.resetAt <= now) failedLogins.delete(ip);
    }
  }
  const next = current ?? { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  next.count += 1;
  failedLogins.set(ipAddress, next);
  return false;
}

export function masterAdminConfigurationReady(): boolean {
  return Boolean(
    process.env.MASTER_ADMIN_USERNAME &&
      process.env.MASTER_ADMIN_PASSWORD &&
      getSessionSecret(),
  );
}

export const masterAdminCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_MAX_AGE_SECONDS * 1000,
  options: {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/api/admin',
    secure: process.env.NODE_ENV === 'production',
  },
};

export function loginIsRateLimited(ipAddress: string): boolean {
  const attempts = failedLogins.get(ipAddress);
  return Boolean(
    attempts &&
      attempts.resetAt > Date.now() &&
      attempts.count >= MAX_LOGIN_ATTEMPTS,
  );
}

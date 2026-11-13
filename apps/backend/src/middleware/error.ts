import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

function databaseErrorCode(error: unknown): string | undefined {
  const visited = new Set<object>();
  let current = error;
  while (
    typeof current === 'object' &&
    current !== null &&
    !visited.has(current)
  ) {
    visited.add(current);
    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

function isDatabaseAvailabilityError(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return Boolean(
    code &&
    (/^08/.test(code) ||
      [
        '53300',
        '57P01',
        'ECONNREFUSED',
        'ECONNRESET',
        'ENOTFOUND',
        'ETIMEDOUT',
        'EHOSTUNREACH',
        'EAI_AGAIN',
      ].includes(code)),
  );
}

function databaseConstraintStatus(error: unknown): number | undefined {
  switch (databaseErrorCode(error)) {
    case '23502':
    case '23514':
    case '22P02':
      return 400;
    case '23503':
    case '23505':
    case '40001':
    case '40P01':
      return 409;
    default:
      return undefined;
  }
}

function isDatabaseSchemaError(error: unknown): boolean {
  return ['42P01', '42703', '42704'].includes(databaseErrorCode(error) ?? '');
}

function isDatabaseConfigurationError(error: unknown): boolean {
  return databaseErrorCode(error) === '42501';
}

export function safeErrorLog(error: unknown): string {
  const detail =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  return detail.replace(
    /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
    '[redacted database URL]',
  );
}

function getParserErrorStatus(error: unknown): number | undefined {
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return error.status;
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  let statusCode = 500;
  let message = 'Internal server error';
  const parserErrorStatus = getParserErrorStatus(error);
  const databaseConstraintCode = databaseConstraintStatus(error);

  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (parserErrorStatus !== undefined) {
    statusCode = parserErrorStatus;
    message = 'Invalid JSON request body.';
  } else if (databaseConstraintCode !== undefined) {
    statusCode = databaseConstraintCode;
    message =
      databaseConstraintCode === 409
        ? 'The request conflicts with existing database records.'
        : 'The request violates a database constraint.';
  } else if (isDatabaseSchemaError(error)) {
    statusCode = 503;
    message =
      'The database schema is not up to date. Apply the database migrations.';
  } else if (isDatabaseConfigurationError(error)) {
    statusCode = 503;
    message = 'The database is not configured to serve this request.';
  } else if (isDatabaseAvailabilityError(error)) {
    statusCode = 503;
    message = 'The database is temporarily unavailable.';
  } else if (error instanceof MulterError) {
    statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Each legal document must be no larger than 10 MB.'
        : 'The document upload did not meet the upload limits.';
  }

  if (statusCode >= 500) {
    console.error('API request failed:', safeErrorLog(error));
  }

  response.status(statusCode).json({ success: false, error: message });
};

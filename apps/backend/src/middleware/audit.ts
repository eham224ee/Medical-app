import { scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import { db, staffAccess } from '@repo/database';
import type { auditLogs } from '@repo/database';
import { HttpError } from './error.js';

export type AuditLogValues = typeof auditLogs.$inferInsert;

function validPassword(
  providedPassword: string,
  salt: string,
  hash: string,
): boolean {
  if (!/^[0-9a-f]{128}$/i.test(hash) || !/^[0-9a-f]{32}$/i.test(salt)) {
    return false;
  }
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(providedPassword, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export function requireActor(): RequestHandler {
  return async (request, _response, next) => {
    if (typeof request.user?.id === 'string' && request.user.id.trim()) {
      next();
      return;
    }

    try {
      const hospitalId = request.params.id;
      const providedPassword = request.header('x-staff-password');
      if (
        typeof hospitalId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          hospitalId,
        )
      ) {
        next(new HttpError('Invalid hospital ID.', 400));
        return;
      }
      if (
        !providedPassword ||
        providedPassword.length < 12 ||
        providedPassword.length > 256
      ) {
        next(new HttpError('Invalid hospital ID or password.', 401));
        return;
      }

      const staff = await db
        .select({
          staffName: staffAccess.staffName,
          passwordSalt: staffAccess.passwordSalt,
          passwordHash: staffAccess.passwordHash,
        })
        .from(staffAccess)
        .where(
          and(
            eq(staffAccess.hospitalId, hospitalId),
            eq(staffAccess.isActive, true),
          ),
        );
      const matchedStaff = staff.find((candidate) =>
        validPassword(
          providedPassword,
          candidate.passwordSalt,
          candidate.passwordHash,
        ),
      );
      if (!matchedStaff) {
        next(new HttpError('Invalid hospital ID or password.', 401));
        return;
      }

      request.user = { id: matchedStaff.staffName };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getActorId(request: Express.Request): string {
  const actorId =
    typeof request.user?.id === 'string' ? request.user.id.trim() : '';
  if (!actorId) {
    throw new HttpError('Authentication is required for this action.', 401);
  }

  return actorId;
}

export function createAuditLog(
  actorId: string,
  hospitalId: string,
  actionType: string,
  payload: unknown,
): AuditLogValues {
  return {
    actorId,
    hospitalId,
    actionType,
    payload: JSON.stringify(payload),
  };
}

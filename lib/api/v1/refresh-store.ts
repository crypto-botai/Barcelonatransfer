import type { ApiRole } from "./types";
import type { RefreshRecord, RefreshTokenStore } from "./tokens";

/**
 * Refresh tokens in the database (table mobile_refresh_tokens).
 *
 * Only the SHA-256 of a token is ever stored. The two writes that decide whether
 * a stolen token can be replayed are single conditional UPDATEs, so two requests
 * arriving at the same moment cannot both win.
 */

// Imported on first use so a tool or test that never touches the store needs no database.
const db = async () => (await import("@/lib/prisma")).prisma;

export class PrismaRefreshTokenStore implements RefreshTokenStore {
  async findByHash(hash: string): Promise<RefreshRecord | null> {
    const r = await (await db()).mobileRefreshToken.findUnique({ where: { tokenHash: hash } });
    if (!r) return null;
    return {
      id: r.id,
      userId: r.userId,
      role: r.role as ApiRole,
      sessionId: r.sessionId,
      familyId: r.familyId,
      tokenHash: r.tokenHash,
      expiresAt: r.expiresAt.getTime(),
      familyStartedAt: r.familyStartedAt.getTime(),
      usedAt: r.usedAt ? r.usedAt.getTime() : null,
      revokedAt: r.revokedAt ? r.revokedAt.getTime() : null,
    };
  }

  async insert(record: RefreshRecord): Promise<void> {
    await (await db()).mobileRefreshToken.create({
      data: {
        id: record.id,
        userId: record.userId,
        role: record.role,
        sessionId: record.sessionId,
        familyId: record.familyId,
        tokenHash: record.tokenHash,
        expiresAt: new Date(record.expiresAt),
        familyStartedAt: new Date(record.familyStartedAt),
      },
    });
  }

  /** One atomic UPDATE ... WHERE usedAt IS NULL. Zero rows changed means someone else already spent it. */
  async markUsed(id: string, at: number): Promise<boolean> {
    const res = await (await db()).mobileRefreshToken.updateMany({
      where: { id, usedAt: null, revokedAt: null },
      data: { usedAt: new Date(at) },
    });
    return res.count === 1;
  }

  async revokeFamily(familyId: string, at: number): Promise<void> {
    await (await db()).mobileRefreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(at) },
    });
  }
}

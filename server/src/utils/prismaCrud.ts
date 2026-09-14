import { Request } from 'express';
import { Prisma } from '@prisma/client';

/** Shape the frontend expects for a populated user/company reference (types/index.ts RefLite). */
export interface RefLite {
  _id: string;
  name: string;
}

export function toRefLite(u: { id: string; name: string } | null | undefined): RefLite | undefined {
  return u ? { _id: u.id, name: u.name } : undefined;
}

export function parsePagination(req: Request, defaultLimit = 20) {
  const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? String(defaultLimit)), 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

/** Translates a Mongoose-style sort string ("-createdAt" or "name") into a Prisma orderBy. */
export function parseSort(sortParam: unknown, defaultField = 'createdAt'): Record<string, 'asc' | 'desc'> {
  const raw = String(sortParam ?? `-${defaultField}`).trim();
  if (raw.startsWith('-')) return { [raw.slice(1)]: 'desc' };
  return { [raw]: 'asc' };
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) };
}

/** Case-insensitive substring match across several string fields, combined with OR — mirrors the old Mongoose $regex-across-fields search. */
export function searchOr(fields: string[], search: unknown): Prisma.Enumerable<Record<string, unknown>> | undefined {
  if (!search || !String(search).trim() || fields.length === 0) return undefined;
  const term = String(search).trim();
  return fields.map((f) => ({ [f]: { contains: term, mode: 'insensitive' } }));
}

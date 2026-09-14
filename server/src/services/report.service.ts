import { prisma } from '../config/prisma';

export type ReportDataset = 'deals' | 'leads' | 'activities' | 'contacts';

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in';
  value: unknown;
}

export interface ReportInput {
  organization: string;
  dataset: ReportDataset;
  fields?: string[];
  filters?: ReportFilter[];
  groupBy?: string;
  metric?: 'count' | 'sum' | 'avg';
  metricField?: string;
  chartType: string;
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
}

const DATASET_DELEGATE = {
  deals: prisma.deal,
  leads: prisma.lead,
  activities: prisma.activity,
  contacts: prisma.contact,
} as const;

const PRISMA_OP: Record<ReportFilter['operator'], string> = {
  eq: 'equals',
  ne: 'not',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
  in: 'in',
};

function buildWhere(orgId: string, filters: ReportFilter[], start?: Date | null, end?: Date | null): Record<string, unknown> {
  const where: Record<string, unknown> = { organizationId: orgId };
  for (const f of filters) {
    where[f.field] = { [PRISMA_OP[f.operator]]: f.value };
  }
  if (start || end) {
    where.createdAt = { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) };
  }
  return where;
}

export interface ReportRunResult {
  dataset: ReportDataset;
  chartType: string;
  rows: Record<string, unknown>[];
  groups?: { key: string; value: number }[];
}

export async function runReport(report: ReportInput): Promise<ReportRunResult> {
  const delegate = DATASET_DELEGATE[report.dataset] as unknown as { findMany: (args: { where: Record<string, unknown>; take: number }) => Promise<Record<string, unknown>[]> };
  const where = buildWhere(report.organization, report.filters ?? [], report.dateRangeStart, report.dateRangeEnd);

  const docs = await delegate.findMany({ where, take: 2000 });

  const projected = docs.map((d) => {
    if (!report.fields?.length) return d;
    const row: Record<string, unknown> = {};
    for (const field of report.fields) row[field] = d[field];
    return row;
  });

  let groups: { key: string; value: number }[] | undefined;
  if (report.groupBy) {
    const map = new Map<string, number>();
    for (const d of docs) {
      const key = String(d[report.groupBy!] ?? 'Unspecified');
      const metricValue = report.metric === 'sum' && report.metricField ? Number(d[report.metricField] ?? 0) : 1;
      map.set(key, (map.get(key) ?? 0) + metricValue);
    }
    if (report.metric === 'avg' && report.metricField) {
      const sums = new Map<string, { total: number; count: number }>();
      for (const d of docs) {
        const key = String(d[report.groupBy!] ?? 'Unspecified');
        const entry = sums.get(key) ?? { total: 0, count: 0 };
        entry.total += Number(d[report.metricField!] ?? 0);
        entry.count += 1;
        sums.set(key, entry);
      }
      groups = Array.from(sums.entries()).map(([key, v]) => ({ key, value: v.count ? Math.round((v.total / v.count) * 100) / 100 : 0 }));
    } else {
      groups = Array.from(map.entries()).map(([key, value]) => ({ key, value }));
    }
  }

  return { dataset: report.dataset, chartType: report.chartType, rows: projected, groups };
}

export function resultToCSV(result: ReportRunResult): string {
  if (result.rows.length === 0) return '';
  const headers = Object.keys(result.rows[0]);
  const escape = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...result.rows.map((row) => headers.map((h) => escape(row[h])).join(','))];
  return lines.join('\n');
}

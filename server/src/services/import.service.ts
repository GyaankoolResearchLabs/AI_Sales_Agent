import { parse } from 'csv-parse/sync';
import { prisma } from '../config/prisma';

export type ImportEntity = 'leads' | 'contacts' | 'companies' | 'deals';

const CRM_FIELDS: Record<ImportEntity, string[]> = {
  leads: ['name', 'email', 'phone', 'companyName', 'jobTitle', 'source', 'status'],
  contacts: ['name', 'email', 'phone', 'jobTitle'],
  companies: ['name', 'industry', 'website', 'employees', 'location'],
  deals: ['name', 'value', 'stageKey', 'expectedCloseDate', 'source'],
};

// Heuristic header -> CRM field suggestions (Section 7 step 4 example mapping).
const HEURISTICS: Record<string, string> = {
  'customer name': 'name',
  'contact name': 'name',
  name: 'name',
  company: 'companyName',
  'company name': 'companyName',
  email: 'email',
  'e-mail': 'email',
  phone: 'phone',
  'phone number': 'phone',
  'deal value': 'value',
  value: 'value',
  amount: 'value',
  stage: 'stageKey',
  status: 'status',
  title: 'jobTitle',
  'job title': 'jobTitle',
  source: 'source',
  website: 'website',
  industry: 'industry',
  employees: 'employees',
  location: 'location',
  'close date': 'expectedCloseDate',
  'expected close date': 'expectedCloseDate',
};

export function parseCSV(buffer: Buffer): { headers: string[]; rows: Record<string, string>[] } {
  const records: Record<string, string>[] = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

export function suggestMapping(headers: string[], entity: ImportEntity): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const fields = CRM_FIELDS[entity];
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    const suggestion = HEURISTICS[key];
    mapping[header] = suggestion && fields.includes(suggestion) ? suggestion : null;
  }
  return mapping;
}

export interface ImportRowResult {
  row: number;
  success: boolean;
  error?: string;
}

export async function commitImport(
  orgId: string,
  userId: string,
  entity: ImportEntity,
  rows: Record<string, string>[],
  mapping: Record<string, string>
): Promise<{ results: ImportRowResult[]; successCount: number; failedCount: number }> {
  const results: ImportRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const mapped: Record<string, unknown> = {};
    for (const [csvHeader, crmField] of Object.entries(mapping)) {
      if (crmField && raw[csvHeader] !== undefined && raw[csvHeader] !== '') {
        mapped[crmField] = raw[csvHeader];
      }
    }

    try {
      if (!mapped.name) throw new Error('Missing required field: name');

      if (entity === 'leads') {
        await prisma.lead.create({
          data: {
            organizationId: orgId,
            createdById: userId,
            name: mapped.name as string,
            email: (mapped.email as string) || undefined,
            phone: mapped.phone as string | undefined,
            companyName: mapped.companyName as string | undefined,
            jobTitle: mapped.jobTitle as string | undefined,
            status: (mapped.status as never) || 'new',
            source: (mapped.source as string) || 'csv_import',
          },
        });
      } else if (entity === 'contacts') {
        await prisma.contact.create({
          data: {
            organizationId: orgId,
            createdById: userId,
            name: mapped.name as string,
            email: (mapped.email as string) || undefined,
            phone: mapped.phone as string | undefined,
            jobTitle: mapped.jobTitle as string | undefined,
            source: 'csv_import',
          },
        });
      } else if (entity === 'companies') {
        await prisma.company.create({
          data: {
            organizationId: orgId,
            createdById: userId,
            name: mapped.name as string,
            industry: mapped.industry as string | undefined,
            website: mapped.website as string | undefined,
            employees: mapped.employees ? Number(mapped.employees) : undefined,
            location: mapped.location as string | undefined,
          },
        });
      } else if (entity === 'deals') {
        await prisma.deal.create({
          data: {
            organizationId: orgId,
            createdById: userId,
            ownerId: userId,
            name: mapped.name as string,
            value: mapped.value ? Number(mapped.value) : 0,
            stageKey: (mapped.stageKey as string) || 'lead',
            expectedCloseDate: mapped.expectedCloseDate ? new Date(mapped.expectedCloseDate as string) : undefined,
            source: (mapped.source as string) || 'csv_import',
          },
        });
      }
      results.push({ row: i + 1, success: true });
    } catch (err) {
      results.push({ row: i + 1, success: false, error: (err as Error).message });
    }
  }

  return {
    results,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
  };
}

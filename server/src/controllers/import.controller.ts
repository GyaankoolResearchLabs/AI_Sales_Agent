import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { parseCSV, suggestMapping, commitImport, ImportEntity } from '../services/import.service';
import { notifyUser } from '../services/notification.service';
import { writeAuditLog } from '../services/audit.service';

export const previewCSV = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) throw AppError.badRequest('CSV file is required (field name "file")');
  const entity = (req.body.entity || req.query.entity) as ImportEntity;
  if (!['leads', 'contacts', 'companies', 'deals'].includes(entity)) throw AppError.badRequest('Invalid entity type');

  const { headers, rows } = parseCSV(req.file.buffer);
  const mapping = suggestMapping(headers, entity);

  res.json({
    success: true,
    data: {
      headers,
      mapping,
      sampleRows: rows.slice(0, 10),
      totalRows: rows.length,
      rows, // returned so the client can submit them back on commit without re-uploading
    },
  });
});

export const commit = catchAsync(async (req: Request, res: Response) => {
  const { entity, rows, mapping } = req.body as { entity: ImportEntity; rows: Record<string, string>[]; mapping: Record<string, string> };
  if (!Array.isArray(rows) || rows.length === 0) throw AppError.badRequest('No rows to import');

  const result = await commitImport(req.user!.organizationId, req.user!.id, entity, rows, mapping);

  await writeAuditLog({
    organization: req.user!.organizationId,
    actorType: 'user',
    actor: req.user!.id,
    action: 'import.completed',
    entityType: entity,
    metadata: { successCount: result.successCount, failedCount: result.failedCount },
  });

  await notifyUser({
    organization: req.user!.organizationId,
    user: req.user!.id,
    type: 'import_completed',
    title: 'Import completed',
    message: `${result.successCount} ${entity} imported successfully, ${result.failedCount} failed.`,
  });

  res.json({ success: true, data: result });
});

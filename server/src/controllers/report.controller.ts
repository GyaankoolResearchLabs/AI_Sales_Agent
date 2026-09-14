import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';
import { runReport, resultToCSV, ReportInput } from '../services/report.service';

function toResponse(r: Prisma.ReportGetPayload<true>) {
  return {
    _id: r.id,
    organization: r.organizationId,
    name: r.name,
    dataset: r.dataset,
    fields: r.fields,
    filters: r.filters,
    groupBy: r.groupBy ?? undefined,
    metric: r.metric ?? undefined,
    metricField: r.metricField ?? undefined,
    chartType: r.chartType,
    dateRangeStart: r.dateRangeStart ?? undefined,
    dateRangeEnd: r.dateRangeEnd ?? undefined,
    scheduleCron: r.scheduleCron ?? undefined,
    createdBy: r.createdById,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toReportInput(orgId: string, r: Prisma.ReportGetPayload<true>): ReportInput {
  return {
    organization: orgId,
    dataset: r.dataset,
    fields: r.fields,
    filters: r.filters as never,
    groupBy: r.groupBy ?? undefined,
    metric: r.metric ?? undefined,
    metricField: r.metricField ?? undefined,
    chartType: r.chartType,
    dateRangeStart: r.dateRangeStart,
    dateRangeEnd: r.dateRangeEnd,
  };
}

export const list = catchAsync(async (req: Request, res: Response) => {
  const reports = await prisma.report.findMany({ where: { organizationId: req.user!.organizationId }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: reports.map(toResponse) });
});

export const create = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const report = await prisma.report.create({
    data: {
      organizationId: req.user!.organizationId,
      createdById: req.user!.id,
      name: body.name as string,
      dataset: body.dataset as never,
      fields: (body.fields as string[]) ?? [],
      filters: (body.filters as Prisma.InputJsonValue) ?? [],
      groupBy: body.groupBy as string | undefined,
      metric: body.metric as never,
      metricField: body.metricField as string | undefined,
      chartType: (body.chartType as never) || 'table',
      dateRangeStart: body.dateRangeStart ? new Date(body.dateRangeStart as string) : undefined,
      dateRangeEnd: body.dateRangeEnd ? new Date(body.dateRangeEnd as string) : undefined,
      scheduleCron: body.scheduleCron as string | undefined,
    },
  });
  res.status(201).json({ success: true, data: toResponse(report) });
});

export const update = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.report.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Report not found');

  const body = req.body as Record<string, unknown>;
  const data: Prisma.ReportUncheckedUpdateInput = {};
  if (body.name !== undefined) data.name = body.name as string;
  if (body.dataset !== undefined) data.dataset = body.dataset as never;
  if (body.fields !== undefined) data.fields = body.fields as string[];
  if (body.filters !== undefined) data.filters = body.filters as Prisma.InputJsonValue;
  if (body.groupBy !== undefined) data.groupBy = body.groupBy as string;
  if (body.metric !== undefined) data.metric = body.metric as never;
  if (body.metricField !== undefined) data.metricField = body.metricField as string;
  if (body.chartType !== undefined) data.chartType = body.chartType as never;
  if (body.dateRangeStart !== undefined) data.dateRangeStart = body.dateRangeStart ? new Date(body.dateRangeStart as string) : null;
  if (body.dateRangeEnd !== undefined) data.dateRangeEnd = body.dateRangeEnd ? new Date(body.dateRangeEnd as string) : null;
  if (body.scheduleCron !== undefined) data.scheduleCron = body.scheduleCron as string;

  const report = await prisma.report.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: toResponse(report) });
});

export const remove = catchAsync(async (req: Request, res: Response) => {
  const existing = await prisma.report.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!existing) throw AppError.notFound('Report not found');
  await prisma.report.delete({ where: { id: req.params.id } });
  res.json({ success: true, data: { id: req.params.id } });
});

export const run = catchAsync(async (req: Request, res: Response) => {
  const report = await prisma.report.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!report) throw AppError.notFound('Report not found');
  const result = await runReport(toReportInput(req.user!.organizationId, report));
  res.json({ success: true, data: result });
});

/** Ad-hoc run without saving a Report document — used by the report builder's live preview. */
export const preview = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  const result = await runReport({
    organization: req.user!.organizationId,
    dataset: body.dataset as never,
    fields: body.fields as string[] | undefined,
    filters: body.filters as never,
    groupBy: body.groupBy as string | undefined,
    metric: body.metric as never,
    metricField: body.metricField as string | undefined,
    chartType: (body.chartType as string) || 'table',
    dateRangeStart: body.dateRangeStart ? new Date(body.dateRangeStart as string) : undefined,
    dateRangeEnd: body.dateRangeEnd ? new Date(body.dateRangeEnd as string) : undefined,
  });
  res.json({ success: true, data: result });
});

export const exportCSV = catchAsync(async (req: Request, res: Response) => {
  const report = await prisma.report.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!report) throw AppError.notFound('Report not found');
  const result = await runReport(toReportInput(req.user!.organizationId, report));
  const csv = resultToCSV(result);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, '_')}.csv"`);
  res.send(csv);
});

export const exportPDF = catchAsync(async (req: Request, res: Response) => {
  const report = await prisma.report.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
  if (!report) throw AppError.notFound('Report not found');
  const result = await runReport(toReportInput(req.user!.organizationId, report));

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/[^a-z0-9]/gi, '_')}.pdf"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);
  doc.fontSize(18).text(report.name, { underline: true });
  doc.moveDown();
  doc.fontSize(10).fillColor('gray').text(`Generated ${new Date().toLocaleString()}`);
  doc.moveDown();

  if (result.groups) {
    doc.fillColor('black').fontSize(12).text('Summary');
    for (const g of result.groups) {
      doc.fontSize(10).text(`${g.key}: ${g.value}`);
    }
  } else if (result.rows.length > 0) {
    const headers = Object.keys(result.rows[0]);
    doc.fillColor('black').fontSize(10).text(headers.join('  |  '));
    doc.moveDown(0.3);
    for (const row of result.rows.slice(0, 200)) {
      doc.text(headers.map((h) => String(row[h] ?? '')).join('  |  '));
    }
  } else {
    doc.text('No data matched this report.');
  }

  doc.end();
});

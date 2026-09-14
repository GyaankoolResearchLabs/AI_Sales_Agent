import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { aiService } from '../ai/aiService';
import { prisma } from '../config/prisma';

export const chat = catchAsync(async (req: Request, res: Response) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string') throw AppError.badRequest('message is required');
  const result = await aiService.chat(req.user!.organizationId, req.user!.id, message, history ?? []);
  res.json({ success: true, data: result });
});

async function buildContentContext(req: Request) {
  const { dealId, contactId, leadId, purpose, tone, reason, objections } = req.body;
  const ctx: Record<string, unknown> = { purpose, tone, reason, objections, senderName: (req as never as { user?: { name?: string } }).user?.name };

  if (dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, organizationId: req.user!.organizationId },
      include: { company: { select: { name: true } }, primaryContact: { select: { name: true } } },
    });
    if (deal) {
      ctx.dealName = deal.name;
      ctx.dealValue = deal.value;
      ctx.currency = deal.currency;
      ctx.companyName = deal.company?.name;
      ctx.contactName = deal.primaryContact?.name;
    }
  }
  if (contactId && !ctx.contactName) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: req.user!.organizationId },
      include: { company: { select: { name: true } } },
    });
    if (contact) {
      ctx.contactName = contact.name;
      if (!ctx.companyName) ctx.companyName = contact.company?.name;
    }
  }
  if (leadId && !ctx.contactName) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId: req.user!.organizationId } });
    if (lead) {
      ctx.contactName = lead.name;
      ctx.companyName = lead.companyName;
    }
  }
  return ctx;
}

export const generateEmail = catchAsync(async (req: Request, res: Response) => {
  const ctx = await buildContentContext(req);
  const result = await aiService.generateEmail(ctx);
  res.json({ success: true, data: result });
});

export const generateWhatsApp = catchAsync(async (req: Request, res: Response) => {
  const ctx = await buildContentContext(req);
  const result = await aiService.generateWhatsApp(ctx);
  res.json({ success: true, data: result });
});

export const generateCallScript = catchAsync(async (req: Request, res: Response) => {
  const ctx = await buildContentContext(req);
  const result = await aiService.generateCallScript(ctx);
  res.json({ success: true, data: result });
});

export const generateProposal = catchAsync(async (req: Request, res: Response) => {
  const ctx = await buildContentContext(req);
  const result = await aiService.generateProposalSectionContent(ctx);
  res.json({ success: true, data: result });
});

export const analyzeDeal = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.analyzeDeal(req.params.dealId, req.user!.organizationId);
  res.json({ success: true, data: result });
});

export const summarizeConversation = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.summarizeConversation(req.params.dealId, req.user!.organizationId);
  res.json({ success: true, data: result });
});

export const runAnomalyDetection = catchAsync(async (req: Request, res: Response) => {
  const result = await aiService.detectAnomalies(req.user!.organizationId);
  res.json({ success: true, data: result });
});

export const forecast = catchAsync(async (req: Request, res: Response) => {
  const groupBy = (req.query.groupBy as 'rep' | 'stage' | 'month') || 'stage';
  const result = await aiService.forecastPipeline(req.user!.organizationId, groupBy);
  res.json({ success: true, data: result });
});

export const recommendNextAction = catchAsync(async (req: Request, res: Response) => {
  const deal = await prisma.deal.findFirst({ where: { id: req.params.dealId, organizationId: req.user!.organizationId } });
  if (!deal) throw AppError.notFound('Deal not found');
  const rec = await aiService.recommendNextAction(req.params.dealId, req.user!.organizationId, deal.ownerId);
  res.json({ success: true, data: rec });
});

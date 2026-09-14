import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { conversationSchema } from '../validators/crm.validators';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';
import { scoreAndSaveDeal } from '../ai/dealScoring.service';

const router = Router();
router.use(requireAuth);

function toResponse(c: {
  id: string;
  organizationId: string;
  channel: string;
  dealId: string | null;
  contactId: string | null;
  leadId: string | null;
  participant: string;
  content: string;
  direction: string;
  sentiment: string | null;
  aiSummary: string | null;
  occurredAt: Date;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    _id: c.id,
    organization: c.organizationId,
    channel: c.channel,
    deal: c.dealId ?? undefined,
    contact: c.contactId ?? undefined,
    lead: c.leadId ?? undefined,
    participant: c.participant,
    content: c.content,
    direction: c.direction,
    sentiment: c.sentiment ?? undefined,
    aiSummary: c.aiSummary ?? undefined,
    occurredAt: c.occurredAt,
    createdBy: c.createdById,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

async function afterMutate(conv: { dealId: string | null; occurredAt: Date; organizationId: string }) {
  if (conv.dealId) {
    await prisma.deal.update({ where: { id: conv.dealId }, data: { lastActivityAt: conv.occurredAt } });
    await scoreAndSaveDeal(conv.dealId, conv.organizationId);
  }
}

router.get(
  '/',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req);
    const where: Prisma.ConversationWhereInput = { organizationId: orgId };
    if (req.query.channel) where.channel = req.query.channel as never;
    if (req.query.deal) where.dealId = String(req.query.deal);
    if (req.query.contact) where.contactId = String(req.query.contact);
    if (req.query.lead) where.leadId = String(req.query.lead);
    const or = searchOr(['participant', 'content'], req.query.search);
    if (or) where.OR = or as Prisma.ConversationWhereInput[];

    const [items, total] = await Promise.all([
      prisma.conversation.findMany({ where, orderBy: parseSort(req.query.sort, 'occurredAt'), skip, take: limit }),
      prisma.conversation.count({ where }),
    ]);

    res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
  })
);

router.post(
  '/',
  validateBody(conversationSchema),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const body = req.body as Record<string, unknown>;
    const conv = await prisma.conversation.create({
      data: {
        organizationId: orgId,
        channel: body.channel as never,
        dealId: (body.deal as string | undefined) || undefined,
        contactId: (body.contact as string | undefined) || undefined,
        leadId: (body.lead as string | undefined) || undefined,
        participant: body.participant as string,
        content: body.content as string,
        direction: (body.direction as never) || 'outbound',
        sentiment: body.sentiment as never,
        occurredAt: body.occurredAt ? new Date(body.occurredAt as string) : undefined,
        createdById: req.user!.id,
      },
    });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'conversation.created',
      entityType: 'Conversation',
      entityId: conv.id,
      after: conv as unknown as Record<string, unknown>,
    });

    await afterMutate(conv);

    res.status(201).json({ success: true, data: toResponse(conv) });
  })
);

router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const conv = await prisma.conversation.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId } });
    if (!conv) throw AppError.notFound('Conversation not found');
    res.json({ success: true, data: toResponse(conv) });
  })
);

router.patch(
  '/:id',
  validateBody(conversationSchema.partial()),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.conversation.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Conversation not found');

    const body = req.body as Record<string, unknown>;
    const data: Prisma.ConversationUncheckedUpdateInput = {};
    if (body.channel !== undefined) data.channel = body.channel as never;
    if (body.deal !== undefined) data.dealId = (body.deal as string) || null;
    if (body.contact !== undefined) data.contactId = (body.contact as string) || null;
    if (body.lead !== undefined) data.leadId = (body.lead as string) || null;
    if (body.participant !== undefined) data.participant = body.participant as string;
    if (body.content !== undefined) data.content = body.content as string;
    if (body.direction !== undefined) data.direction = body.direction as never;
    if (body.sentiment !== undefined) data.sentiment = body.sentiment as never;
    if (body.occurredAt !== undefined) data.occurredAt = body.occurredAt ? new Date(body.occurredAt as string) : undefined;

    const conv = await prisma.conversation.update({ where: { id: req.params.id }, data });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'conversation.updated',
      entityType: 'Conversation',
      entityId: conv.id,
      before: existing as unknown as Record<string, unknown>,
      after: conv as unknown as Record<string, unknown>,
    });

    await afterMutate(conv);

    res.json({ success: true, data: toResponse(conv) });
  })
);

router.delete(
  '/:id',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.conversation.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Conversation not found');
    await prisma.conversation.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'conversation.deleted',
      entityType: 'Conversation',
      entityId: req.params.id,
      before: existing as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: { id: req.params.id } });
  })
);

export default router;

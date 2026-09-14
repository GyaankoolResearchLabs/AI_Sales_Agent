import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { meetingSchema } from '../validators/meeting.validators';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { writeAuditLog } from '../services/audit.service';
import { prisma } from '../config/prisma';
import { toRefLite, parsePagination, parseSort, paginationMeta, searchOr } from '../utils/prismaCrud';

const router = Router();
router.use(requireAuth);

const INCLUDE = { organizer: { select: { id: true, name: true } } } as const;

function toResponse(m: Prisma.MeetingGetPayload<{ include: typeof INCLUDE }>) {
  return {
    _id: m.id,
    organization: m.organizationId,
    title: m.title,
    deal: m.dealId ?? undefined,
    contact: m.contactId ?? undefined,
    organizer: toRefLite(m.organizer),
    attendees: m.attendees,
    startTime: m.startTime,
    endTime: m.endTime,
    location: m.location ?? undefined,
    meetingLink: m.meetingLink ?? undefined,
    provider: m.provider,
    status: m.status,
    aiPreparationNotes: m.aiPreparationNotes ?? undefined,
    loggedActivity: m.loggedActivityId ?? undefined,
    createdBy: m.createdById,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/** Logs a real Activity once a meeting is marked completed — mirrors the old Mongoose afterMutate hook. */
async function logActivityIfCompleted(meeting: Prisma.MeetingGetPayload<true>) {
  if (meeting.status !== 'completed' || meeting.loggedActivityId) return;
  const activity = await prisma.activity.create({
    data: {
      organizationId: meeting.organizationId,
      type: 'meeting',
      subject: meeting.title,
      dealId: meeting.dealId ?? undefined,
      contactId: meeting.contactId ?? undefined,
      ownerId: meeting.organizerId,
      isCompleted: true,
      completedAt: meeting.endTime,
      createdById: meeting.organizerId,
    },
  });
  await prisma.meeting.update({ where: { id: meeting.id }, data: { loggedActivityId: activity.id } });
}

router.get(
  '/',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const { page, limit, skip } = parsePagination(req);
    const where: Prisma.MeetingWhereInput = { organizationId: orgId };
    if (req.query.status) where.status = req.query.status as never;
    if (req.query.deal) where.dealId = String(req.query.deal);
    const or = searchOr(['title'], req.query.search);
    if (or) where.OR = or as Prisma.MeetingWhereInput[];

    const [items, total] = await Promise.all([
      prisma.meeting.findMany({ where, orderBy: parseSort(req.query.sort, 'startTime'), skip, take: limit, include: INCLUDE }),
      prisma.meeting.count({ where }),
    ]);

    res.json({ success: true, data: items.map(toResponse), pagination: paginationMeta(page, limit, total) });
  })
);

router.post(
  '/',
  validateBody(meetingSchema),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const body = req.body as Record<string, unknown>;
    const meeting = await prisma.meeting.create({
      data: {
        organizationId: orgId,
        title: body.title as string,
        dealId: (body.deal as string | undefined) || undefined,
        contactId: (body.contact as string | undefined) || undefined,
        organizerId: (body.organizer as string | undefined) || req.user!.id,
        attendees: (body.attendees as string[]) ?? [],
        startTime: new Date(body.startTime as string),
        endTime: new Date(body.endTime as string),
        location: body.location as string | undefined,
        provider: 'development',
        status: (body.status as never) || 'scheduled',
        createdById: req.user!.id,
      },
      include: INCLUDE,
    });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'meeting.created',
      entityType: 'Meeting',
      entityId: meeting.id,
      after: meeting as unknown as Record<string, unknown>,
    });

    await logActivityIfCompleted(meeting);

    res.status(201).json({ success: true, data: toResponse(meeting) });
  })
);

router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, organizationId: req.user!.organizationId }, include: INCLUDE });
    if (!meeting) throw AppError.notFound('Meeting not found');
    res.json({ success: true, data: toResponse(meeting) });
  })
);

router.patch(
  '/:id',
  validateBody(meetingSchema.partial()),
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.meeting.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Meeting not found');

    const body = req.body as Record<string, unknown>;
    const data: Prisma.MeetingUncheckedUpdateInput = {};
    if (body.title !== undefined) data.title = body.title as string;
    if (body.deal !== undefined) data.dealId = (body.deal as string) || null;
    if (body.contact !== undefined) data.contactId = (body.contact as string) || null;
    if (body.attendees !== undefined) data.attendees = body.attendees as string[];
    if (body.startTime !== undefined) data.startTime = new Date(body.startTime as string);
    if (body.endTime !== undefined) data.endTime = new Date(body.endTime as string);
    if (body.location !== undefined) data.location = body.location as string;
    if (body.status !== undefined) data.status = body.status as never;

    const meeting = await prisma.meeting.update({ where: { id: req.params.id }, data, include: INCLUDE });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'meeting.updated',
      entityType: 'Meeting',
      entityId: meeting.id,
      before: existing as unknown as Record<string, unknown>,
      after: meeting as unknown as Record<string, unknown>,
    });

    await logActivityIfCompleted(meeting);

    res.json({ success: true, data: toResponse(meeting) });
  })
);

router.delete(
  '/:id',
  catchAsync(async (req, res) => {
    const orgId = req.user!.organizationId;
    const existing = await prisma.meeting.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!existing) throw AppError.notFound('Meeting not found');
    await prisma.meeting.delete({ where: { id: req.params.id } });

    await writeAuditLog({
      organization: orgId,
      actorType: 'user',
      actor: req.user!.id,
      action: 'meeting.deleted',
      entityType: 'Meeting',
      entityId: req.params.id,
      before: existing as unknown as Record<string, unknown>,
    });

    res.json({ success: true, data: { id: req.params.id } });
  })
);

export default router;

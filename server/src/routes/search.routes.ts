import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { prisma } from '../config/prisma';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  catchAsync(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) throw AppError.badRequest('Query parameter "q" is required');
    const orgId = req.user!.organizationId;
    const limit = 8;
    const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });

    const [leads, contacts, companies, deals, activities] = await Promise.all([
      prisma.lead.findMany({
        where: { organizationId: orgId, OR: [{ name: contains(q) }, { email: contains(q) }, { companyName: contains(q) }] },
        take: limit,
        select: { id: true, name: true, email: true, companyName: true, status: true, score: true },
      }),
      prisma.contact.findMany({
        where: { organizationId: orgId, OR: [{ name: contains(q) }, { email: contains(q) }] },
        take: limit,
        select: { id: true, name: true, email: true, jobTitle: true },
      }),
      prisma.company.findMany({ where: { organizationId: orgId, name: contains(q) }, take: limit, select: { id: true, name: true, industry: true } }),
      prisma.deal.findMany({ where: { organizationId: orgId, name: contains(q) }, take: limit, select: { id: true, name: true, value: true, stageKey: true } }),
      prisma.activity.findMany({ where: { organizationId: orgId, subject: contains(q) }, take: limit, select: { id: true, subject: true, type: true, createdAt: true } }),
    ]);

    res.json({
      success: true,
      data: {
        leads: leads.map((l) => ({ id: l.id, type: 'lead', label: l.name, sublabel: l.companyName || l.email })),
        contacts: contacts.map((c) => ({ id: c.id, type: 'contact', label: c.name, sublabel: c.jobTitle || c.email })),
        companies: companies.map((c) => ({ id: c.id, type: 'company', label: c.name, sublabel: c.industry })),
        deals: deals.map((d) => ({ id: d.id, type: 'deal', label: d.name, sublabel: `$${d.value.toLocaleString()}` })),
        activities: activities.map((a) => ({ id: a.id, type: 'activity', label: a.subject, sublabel: a.type })),
      },
    });
  })
);

export default router;

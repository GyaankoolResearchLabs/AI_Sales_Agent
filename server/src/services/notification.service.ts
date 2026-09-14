import { NotificationType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { getIO } from '../realtime/io';

interface NotifyParams {
  organization: string;
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function notifyUser(params: NotifyParams) {
  const notification = await prisma.notification.create({
    data: {
      organizationId: params.organization,
      userId: params.user,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    },
  });
  try {
    getIO()?.to(`user:${params.user}`).emit('notification:new', notification);
  } catch {
    // Socket layer not initialized (e.g. in tests) — notification is still persisted.
  }
  return notification;
}

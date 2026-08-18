import prisma from './database';

export type PolicyResult = 'ALLOW' | 'DENY';

export async function logAuditEvent(
  userId: string | undefined,
  action: string,
  resource: string,
  resourceId: string | null,
  result: 'ALLOW' | 'DENY' | 'SUCCESS' | 'FAILURE',
  ip?: string,
  metadata?: any
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        resource,
        resourceId,
        result,
        ip: ip || null,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
  } catch (error) {
    console.error('[Audit Log Error]', error);
  }
}

export async function checkPolicy(
  userId: string | undefined,
  role: string,
  action: string,
  resource: string,
  resourceId?: string
): Promise<boolean> {
  // If user is Admin, allow everything
  if (role === 'ADMIN') return true;

  // Query policy from DB
  const policy = await prisma.securityPolicy.findUnique({
    where: {
      role_resource_action: {
        role,
        resource,
        action
      }
    }
  });

  // Default fallback if no policy defined: DENY
  if (!policy) {
    return false;
  }

  if (policy.rule === 'ALLOW') {
    return true;
  }

  if (policy.rule === 'DENY') {
    return false;
  }

  if (policy.rule === 'OWNER_ONLY' && userId && resourceId) {
    if (resource === 'project') {
      const project = await prisma.project.findUnique({ where: { id: resourceId } });
      return project ? (project.clientId === userId || project.contractorId === userId) : false;
    }
    if (resource === 'booking') {
      const booking = await prisma.booking.findUnique({
        where: { id: resourceId },
        include: { profile: true }
      });
      return booking ? (booking.clientId === userId || booking.profile.userId === userId) : false;
    }
    if (resource === 'document') {
      const doc = await prisma.document.findUnique({ where: { id: resourceId } });
      return doc ? doc.ownerId === userId : false;
    }
  }

  return false;
}

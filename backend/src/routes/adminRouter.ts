import { Router } from 'express';
import prisma from '../database';
import { requireAuth, AuthenticatedRequest, requireRole } from '../middleware';
import { requireString } from '../validation';

const router = Router();

// Apply ADMIN role requirement to all routes in this router
router.use(requireAuth, requireRole('ADMIN'));

router.get('/applications', async (req, res, next) => {
  try {
    const apps = await prisma.proApplication.findMany({ where: { status: 'Pending' } });
    res.json({ data: apps });
  } catch (error) {
    next(error);
  }
});

router.patch('/applications/:id', async (req, res, next) => {
  try {
    const id = requireString(req.params.id, 'id', 1, 100);
    const status = requireString(req.body?.status, 'status', 1, 50);
    const updated = await prisma.proApplication.update({ where: { id }, data: { status } });
    if (status === 'Approved') {
      await prisma.user.update({ where: { id: updated.userId }, data: { role: 'PROFESSIONAL' } });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/flags', async (req, res, next) => {
  try {
    const flags = await prisma.flaggedPost.findMany();
    res.json({ data: flags });
  } catch (error) {
    next(error);
  }
});

router.delete('/flags/:id', async (req, res, next) => {
  try {
    const id = requireString(req.params.id, 'id', 1, 100);
    await prisma.flaggedPost.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

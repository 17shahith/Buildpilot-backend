import { Router } from 'express';
import prisma from '../database';
import { requireAuth, AuthenticatedRequest } from '../middleware';
import { requireString, finiteNumber, optionalString } from '../validation';

const router = Router();

router.use(requireAuth);

// Helper to check if user has access to project
async function checkProjectAccess(projectId: string, userId: string, userRole: string) {
  if (userRole === 'ADMIN') return true;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;
  return project.clientId === userId || project.contractorId === userId;
}

// ----------------------------------------------------
// PROJECT ROUTES
// ----------------------------------------------------

// Create Project
router.post('/', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'CLIENT' && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only clients can create projects' });
      return;
    }
    const name = requireString(req.body?.name, 'name', 1, 200);
    const budget = finiteNumber(req.body?.budget, 'budget', 0, 1_000_000_000);
    const contractorId = optionalString(req.body?.contractorId, 'contractorId', 100);

    const project = await prisma.project.create({
      data: {
        name,
        budget,
        clientId: user.id,
        contractorId: contractorId || null
      }
    });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

// Get Projects
router.get('/', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    let projects;
    if (user.role === 'ADMIN') {
      projects = await prisma.project.findMany({
        include: { client: { select: { email: true } }, contractor: { select: { email: true } } }
      });
    } else if (user.role === 'PROFESSIONAL') {
      projects = await prisma.project.findMany({
        where: { contractorId: user.id },
        include: { client: { select: { email: true } } }
      });
    } else {
      projects = await prisma.project.findMany({
        where: { clientId: user.id },
        include: { contractor: { select: { email: true } } }
      });
    }
    res.json({ data: projects });
  } catch (error) {
    next(error);
  }
});

// Get Single Project
router.get('/:id', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const id = requireString(req.params.id, 'id');
    const hasAccess = await checkProjectAccess(id, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        milestones: { include: { tasks: true } },
        expenses: true,
        payments: true,
        documents: true
      }
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Update Project
router.patch('/:id', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const id = requireString(req.params.id, 'id');
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.clientId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only the project owner can update project parameters' });
      return;
    }
    const name = optionalString(req.body?.name, 'name', 200);
    const budget = req.body?.budget !== undefined ? finiteNumber(req.body?.budget, 'budget', 0, 1_000_000_000) : undefined;
    const status = optionalString(req.body?.status, 'status', 50);
    const contractorId = optionalString(req.body?.contractorId, 'contractorId', 100);

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(budget !== undefined ? { budget } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(contractorId !== undefined ? { contractorId: contractorId || null } : {})
      }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete Project
router.delete('/:id', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const id = requireString(req.params.id, 'id');
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    if (project.clientId !== user.id && user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only the project owner can delete the project' });
      return;
    }
    await prisma.project.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// MILESTONE ROUTES
// ----------------------------------------------------

router.post('/:id/milestones', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const projectId = requireString(req.params.id, 'projectId');
    const hasAccess = await checkProjectAccess(projectId, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const title = requireString(req.body?.title, 'title', 1, 200);
    const milestone = await prisma.milestone.create({
      data: { title, projectId }
    });
    res.status(201).json(milestone);
  } catch (error) {
    next(error);
  }
});

router.patch('/milestones/:id', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const id = requireString(req.params.id, 'id');
    const milestone = await prisma.milestone.findUnique({ where: { id } });
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }
    const hasAccess = await checkProjectAccess(milestone.projectId, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const title = optionalString(req.body?.title, 'title', 200);
    const status = optionalString(req.body?.status, 'status', 50);

    const updated = await prisma.milestone.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(status !== undefined ? { status } : {})
      }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// TASK ROUTES
// ----------------------------------------------------

router.post('/milestones/:id/tasks', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const milestoneId = requireString(req.params.id, 'milestoneId');
    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) {
      res.status(404).json({ error: 'Milestone not found' });
      return;
    }
    const hasAccess = await checkProjectAccess(milestone.projectId, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const title = requireString(req.body?.title, 'title', 1, 200);
    const assigneeId = optionalString(req.body?.assigneeId, 'assigneeId', 100);

    const task = await prisma.task.create({
      data: {
        title,
        milestoneId,
        assigneeId: assigneeId || null
      }
    });
    res.status(201).json(task);
  } catch (error) {
    next(error);
  }
});

router.patch('/tasks/:id', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const id = requireString(req.params.id, 'id');
    const task = await prisma.task.findUnique({
      where: { id },
      include: { milestone: true }
    });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const hasAccess = await checkProjectAccess(task.milestone.projectId, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const title = optionalString(req.body?.title, 'title', 200);
    const status = optionalString(req.body?.status, 'status', 50);
    const assigneeId = optionalString(req.body?.assigneeId, 'assigneeId', 100);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {})
      }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// FINANCIAL & PROGRESS METRICS
// ----------------------------------------------------

router.post('/:id/expenses', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const projectId = requireString(req.params.id, 'projectId');
    const hasAccess = await checkProjectAccess(projectId, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const amount = finiteNumber(req.body?.amount, 'amount', 0, 10000000);
    const category = requireString(req.body?.category, 'category', 1, 100);

    const expense = await prisma.expense.create({
      data: { amount, category, projectId }
    });
    res.status(201).json(expense);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/payments', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const projectId = requireString(req.params.id, 'projectId');
    const hasAccess = await checkProjectAccess(projectId, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const amount = finiteNumber(req.body?.amount, 'amount', 0, 10000000);
    const status = optionalString(req.body?.status, 'status', 50) || 'PENDING';

    const payment = await prisma.payment.create({
      data: { amount, status, projectId }
    });
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/progress', async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const projectId = requireString(req.params.id, 'projectId');
    const hasAccess = await checkProjectAccess(projectId, user.id, user.role);
    if (!hasAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { include: { tasks: true } },
        expenses: true
      }
    });
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const tasks = project.milestones.flatMap((m) => m.tasks);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalExpenses = project.expenses.reduce((sum, e) => sum + e.amount, 0);
    const remainingBudget = project.budget - totalExpenses;

    res.json({
      progressPercentage,
      totalTasks,
      completedTasks,
      totalExpenses,
      remainingBudget
    });
  } catch (error) {
    next(error);
  }
});

export default router;

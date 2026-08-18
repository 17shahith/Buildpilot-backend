import express, { Request, Response } from 'express';
import cors from 'cors';
import { Prisma } from '@prisma/client';
import path from 'node:path';
import prisma from './database';
import { getConfig } from './config';
import { asyncHandler, errorHandler, securityHeaders } from './middleware';
import { pageParams, optionalString, finiteNumber, ValidationError, requireString } from './validation';

// Sub-routers
import authRouter from './routes/authRouter';
import projectRouter from './routes/projectRouter';
import bookingRouter from './routes/bookingRouter';
import adminRouter from './routes/adminRouter';
import aiRouter from './routes/aiRouter';
import uploadRouter from './routes/uploadRouter';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
app.use(securityHeaders);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || getConfig().corsOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin is not allowed'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '100kb' }));

// Static directory for uploaded documents
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'Backend Running', timestamp: new Date().toISOString() });
});

app.get('/api/health', asyncHandler(async (_req, res) => {
  await prisma.user.findFirst();
  res.json({ status: 'healthy', uptime: process.uptime(), version: '1.0.0' });
}));

// Modular sub-routers routing
app.use('/api/auth', authRouter);
app.use('/api/projects', projectRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/admin', adminRouter);
app.use('/api', aiRouter); // Maps /api/estimate, /api/defect-detection, /api/chat
app.use('/api/upload', uploadRouter);

// Marketplace endpoints
app.get('/api/professionals', asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req.query as Record<string, unknown>);
  const role = optionalString(req.query.role, 'role', 100);
  const location = optionalString(req.query.location, 'location', 100);
  const search = optionalString(req.query.search, 'search', 100);
  const where: Prisma.ProfileWhereInput = {
    user: { role: 'PROFESSIONAL' },
    ...(role ? { roleTitle: { contains: role, mode: 'insensitive' } } : {}),
    ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
    ...(search ? { OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { roleTitle: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } }
    ] } : {})
  };
  const [profiles, total] = await prisma.$transaction([
    prisma.profile.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, select: {
      id: true, name: true, roleTitle: true, rating: true, reviewsCount: true, hourlyRate: true, location: true, avatarUrl: true, tags: true, verified: true
    } }),
    prisma.profile.count({ where })
  ]);
  res.json({ data: profiles.map((profile) => ({ ...profile, role: profile.roleTitle ?? 'Professional', reviews: profile.reviewsCount, rate: profile.hourlyRate ?? 0, image: profile.avatarUrl })), page, limit, total });
}));

app.get('/api/properties', asyncHandler(async (req, res) => {
  const { page, limit } = pageParams(req.query as Record<string, unknown>);
  const type = optionalString(req.query.type, 'type', 10)?.toUpperCase();
  const search = optionalString(req.query.search, 'search', 100);
  const minPrice = req.query.minPrice === undefined ? undefined : finiteNumber(req.query.minPrice, 'minPrice', 0, 1_000_000_000);
  const maxPrice = req.query.maxPrice === undefined ? undefined : finiteNumber(req.query.maxPrice, 'maxPrice', 0, 1_000_000_000);
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw new ValidationError('minPrice cannot exceed maxPrice');
  if (type && !['BUY', 'RENT'].includes(type)) throw new ValidationError('type is invalid');
  const where: Prisma.PropertyWhereInput = {
    ...(type ? { type: type as 'BUY' | 'RENT' } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined ? { price: { gte: minPrice, lte: maxPrice } } : {}),
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] } : {})
  };
  const [properties, total] = await prisma.$transaction([
    prisma.property.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.property.count({ where })
  ]);
  res.json({ data: properties.map((property) => ({ ...property, type: property.type === 'BUY' ? 'Buy' : 'Rent', image: property.imageUrl })), page, limit, total });
}));

// Backwards-compatible stubs for old direct route structures
app.get('/api/leads', asyncHandler(async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: leads });
}));

app.post('/api/quotes', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const clientName = requireString(req.body?.clientName, 'clientName', 1, 100);
  const materialCost = finiteNumber(req.body?.materialCost, 'materialCost', 0, 100000000);
  const laborCost = finiteNumber(req.body?.laborCost, 'laborCost', 0, 100000000);
  const totalCost = materialCost + laborCost;
  const remarks = optionalString(req.body?.remarks, 'remarks', 2000);
  const quote = await prisma.quote.create({
    data: { professionalId: user?.id || '664b4c8d8b9e69315d18d451', clientName, materialCost, laborCost, totalCost, remarks }
  });
  res.status(201).json(quote);
}));

app.use(errorHandler);

export default app;

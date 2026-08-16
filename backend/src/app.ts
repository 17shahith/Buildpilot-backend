import express, { Request, Response } from 'express';
import cors from 'cors';
import { Prisma, Role } from '@prisma/client';
import prisma from './database';
import { assertPasswordPolicy, createAccessToken, hashPassword, verifyPassword } from './auth';
import { getConfig } from './config';
import { asyncHandler, AuthenticatedRequest, errorHandler, requireAuth, securityHeaders } from './middleware';
import { rateLimit } from './rateLimit';
import { revokeToken } from './revocation';
import { finiteNumber, isValidEmail, optionalString, pageParams, requireString, ValidationError } from './validation';

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

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'Backend Running', timestamp: new Date().toISOString() });
});

app.get('/api/health', asyncHandler(async (_req, res) => {
  await prisma.user.findFirst();
  res.json({ status: 'healthy', uptime: process.uptime(), version: '1.0.0' });
}));

type EstimateResponse = {
  totalEstimate: number;
  materials: Array<{ name: string; qty: number; unitCost: number }>;
  breakdown: Array<{ category: string; percentage: number; cost: number }>;
  currency: 'USD';
  optimizations: string[];
};

const localEstimate = (area: number, quality: string, floors: number, type: string): EstimateResponse => {
  const baseRate = type === 'renovation' ? 120 : 190;
  const qualityMultiplier = quality === 'luxury' ? 1.8 : quality === 'premium' ? 1.4 : 1;
  const estimatedCost = area * baseRate * qualityMultiplier * (1 + (floors - 1) * 0.15);
  const breakdown = [
    ['Excavation & Foundations', 15], ['Structural Frame & Pillars', 35], ['Brickwork & Plastering', 15],
    ['Flooring, Tiles & Tiling', 12], ['Electrical, Plumbing & HVAC', 13], ['Finishing & Painting', 10]
  ].map(([category, percentage]) => ({
    category: category as string,
    percentage: percentage as number,
    cost: Math.round(estimatedCost * (percentage as number) / 100)
  }));
  return {
    totalEstimate: Math.round(estimatedCost),
    materials: [
      { name: 'Cement (50kg bags)', qty: Math.round(area * 0.4 * qualityMultiplier), unitCost: 12 },
      { name: 'Bricks (Red clay)', qty: Math.round(area * 45 * qualityMultiplier), unitCost: 0.65 },
      { name: 'Steel rebars (tons)', qty: Number((area * 0.007 * qualityMultiplier).toFixed(2)), unitCost: 1100 },
      { name: 'Sand (tons)', qty: Math.round(area * 0.15 * qualityMultiplier), unitCost: 45 },
      { name: 'Aggregate (tons)', qty: Math.round(area * 0.18 * qualityMultiplier), unitCost: 55 },
      { name: 'Paint (litres)', qty: Math.round(area * 0.8 * (quality === 'luxury' ? 1.5 : 1)), unitCost: 8 }
    ],
    breakdown,
    currency: 'USD',
    optimizations: [
      'Switching to AAC blocks instead of red bricks can reduce structural cost.',
      'Procuring aggregates directly can reduce delivery markups.',
      'High-grade fly-ash cement can reduce thermal cracking.'
    ]
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseModelEstimate(value: unknown): EstimateResponse | undefined {
  if (!isRecord(value) || typeof value.totalEstimate !== 'number' || !Number.isFinite(value.totalEstimate) || !Array.isArray(value.materials)) return undefined;
  const materials = value.materials.filter(isRecord).map((item) => ({
    name: typeof item.name === 'string' ? item.name.slice(0, 100) : '',
    qty: typeof item.qty === 'number' && Number.isFinite(item.qty) ? item.qty : NaN,
    unitCost: typeof item.unitCost === 'number' && Number.isFinite(item.unitCost) ? item.unitCost : NaN
  }));
  if (materials.length === 0 || materials.some((item) => !item.name || item.qty < 0 || item.unitCost < 0)) return undefined;
  const breakdown = Array.isArray(value.breakdown) ? value.breakdown.filter(isRecord).map((item) => ({
    category: typeof item.category === 'string' ? item.category.slice(0, 100) : '',
    percentage: typeof item.percentage === 'number' ? item.percentage : NaN,
    cost: typeof item.cost === 'number' ? item.cost : NaN
  })) : [];
  if (breakdown.length === 0 || breakdown.some((item) => !item.category || !Number.isFinite(item.percentage) || item.percentage < 0 || item.percentage > 100 || !Number.isFinite(item.cost) || item.cost < 0)) return undefined;
  const optimizations = Array.isArray(value.optimizations) ? value.optimizations.filter((item): item is string => typeof item === 'string').slice(0, 10) : [];
  return { totalEstimate: value.totalEstimate, materials, breakdown, currency: 'USD', optimizations };
}

app.post('/api/estimate', rateLimit('estimate', 20, 60), asyncHandler(async (req, res) => {
  const area = finiteNumber(req.body?.area, 'area', 1, 10_000_000);
  const floors = finiteNumber(req.body?.floors, 'floors', 1, 100);
  const quality = requireString(req.body?.quality, 'quality', 1, 20);
  const type = requireString(req.body?.type, 'type', 1, 20);
  if (!['standard', 'premium', 'luxury'].includes(quality) || !['new', 'renovation'].includes(type)) throw new ValidationError('quality or type is invalid');
  const fallback = localEstimate(area, quality, floors, type);
  const apiKey = getConfig().groqApiKey;
  if (!apiKey) return res.json(fallback);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Return only a JSON construction estimate.' },
          { role: 'user', content: `Area: ${area}; quality: ${quality}; floors: ${floors}; type: ${type}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      }),
      signal: controller.signal
    });
    if (!groqResponse.ok) throw new Error(`Estimator provider returned ${groqResponse.status}`);
    const body: unknown = await groqResponse.json();
    const content = isRecord(body) && Array.isArray(body.choices) && isRecord(body.choices[0]) && isRecord(body.choices[0].message) ? body.choices[0].message.content : undefined;
    if (typeof content !== 'string') throw new Error('Estimator provider returned no content');
    const parsed = parseModelEstimate(JSON.parse(content));
    return res.json(parsed ?? fallback);
  } catch (error) {
    console.error('[Estimator]', error instanceof Error ? error.message : 'provider failure');
    return res.json(fallback);
  } finally {
    clearTimeout(timeoutId);
  }
}));

app.post('/api/defect-detection', requireAuth, rateLimit('defect-detection', 10, 60), asyncHandler(async (req, res) => {
  optionalString(req.body?.imageUrl, 'imageUrl', 2048);
  res.status(501).json({ error: 'Defect detection is not configured for this deployment' });
}));

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

app.post('/api/chat', rateLimit('chat', 30, 60), (req, res) => {
  const message = requireString(req.body?.message, 'message', 1, 2000).toLowerCase();
  let response = 'I am BuildBridge AI, your construction copilot.';
  if (message.includes('cost') || message.includes('estimate') || message.includes('budget')) response = 'Use the estimator to calculate construction costs from area, quality, floors, and build type.';
  else if (message.includes('defect') || message.includes('crack') || message.includes('damage')) response = 'Upload a supported inspection image after defect detection is enabled.';
  else if (message.includes('engineer') || message.includes('architect') || message.includes('contractor')) response = 'Browse the professionals marketplace to find a construction specialist.';
  res.json({ response });
});

app.post('/api/auth/register', rateLimit('register', 5, 900), asyncHandler(async (req, res) => {
  const email = requireString(req.body?.email, 'email', 3, 254).toLowerCase();
  const password = requireString(req.body?.password, 'password', 12, 128);
  assertPasswordPolicy(password);
  const requestedRole = req.body?.role;
  if (!['CLIENT', 'PROFESSIONAL'].includes(requestedRole)) throw new ValidationError('role must be CLIENT or PROFESSIONAL');
  if (!isValidEmail(email)) throw new ValidationError('email is invalid');
  const name = optionalString(req.body?.name, 'name', 100) ?? email.split('@')[0];
  const user = await prisma.user.create({
    data: { email, password: await hashPassword(password), role: requestedRole as Role, profile: { create: { name, tags: [] } } },
    select: { id: true, email: true, role: true, profile: true }
  });
  res.status(201).json({ message: 'User registered successfully', user });
}));

app.post('/api/auth/login', rateLimit('login', 10, 900), asyncHandler(async (req, res) => {
  const email = requireString(req.body?.email, 'email', 3, 254).toLowerCase();
  const password = requireString(req.body?.password, 'password', 1, 128);
  if (!isValidEmail(email)) throw new ValidationError('email or password is invalid');
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, password: true, role: true, profile: true } });
  if (!user || !(await verifyPassword(password, user.password))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  res.json({ message: 'Login successful', token: createAccessToken(user), user: { id: user.id, email: user.email, role: user.role, profile: user.profile } });
}));

app.post('/api/auth/logout', requireAuth, asyncHandler(async (req, res) => {
  const header = req.get('authorization')!;
  const token = header.slice(7).trim();
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { exp: number };
  await revokeToken(token, claims.exp);
  res.status(204).send();
}));

app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const record = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, role: true, profile: true } });
  if (!record) { res.status(401).json({ error: 'User no longer exists' }); return; }
  res.json(record);
}));

app.post('/api/bookings', requireAuth, rateLimit('bookings', 20, 60), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const profileId = requireString(req.body?.profileId, 'profileId', 1, 100);
  const date = new Date(requireString(req.body?.date, 'date', 1, 64));
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) throw new ValidationError('date must be a future date');
  const notes = optionalString(req.body?.notes, 'notes', 2000);
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true } });
  if (!profile) { res.status(404).json({ error: 'Professional profile not found' }); return; }
  const booking = await prisma.booking.create({ data: { clientId: user.id, profileId, date, notes }, select: { id: true, profileId: true, date: true, status: true, notes: true, createdAt: true } });
  res.status(201).json(booking);
}));

app.get('/api/bookings', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const bookings = await prisma.booking.findMany({
    where: { OR: [{ clientId: user.id }, { profile: { userId: user.id } }] },
    orderBy: { date: 'desc' }, take: 100,
    select: { id: true, clientId: true, profileId: true, date: true, status: true, notes: true, createdAt: true }
  });
  res.json({ data: bookings });
}));

app.patch('/api/bookings/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const id = requireString(req.params.id, 'id', 1, 100);
  const booking = await prisma.booking.findFirst({ where: { id, OR: [{ clientId: user.id }, { profile: { userId: user.id } }] } });
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return; }
  const updated = await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' }, select: { id: true, status: true } });
  res.json(updated);
}));

app.post('/api/upload', requireAuth, rateLimit('upload', 10, 60), (_req, res) => {
  res.status(501).json({ error: 'File upload storage is not configured for this deployment' });
});

app.get('/api/leads', requireAuth, asyncHandler(async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: leads });
}));

app.post('/api/quotes', requireAuth, rateLimit('quotes', 10, 60), asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const clientName = requireString(req.body?.clientName, 'clientName', 1, 100);
  const materialCost = finiteNumber(req.body?.materialCost, 'materialCost', 0, 100000000);
  const laborCost = finiteNumber(req.body?.laborCost, 'laborCost', 0, 100000000);
  const totalCost = materialCost + laborCost;
  const remarks = optionalString(req.body?.remarks, 'remarks', 2000);
  const quote = await prisma.quote.create({
    data: { professionalId: user.id, clientName, materialCost, laborCost, totalCost, remarks }
  });
  res.status(201).json(quote);
}));

app.get('/api/admin/applications', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'ADMIN') { res.status(403).json({ error: 'Forbidden' }); return; }
  const apps = await prisma.proApplication.findMany({ where: { status: 'Pending' } });
  res.json({ data: apps });
}));

app.patch('/api/admin/applications/:id', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'ADMIN') { res.status(403).json({ error: 'Forbidden' }); return; }
  const id = requireString(req.params.id, 'id', 1, 100);
  const status = requireString(req.body?.status, 'status', 1, 50);
  const updated = await prisma.proApplication.update({ where: { id }, data: { status } });
  if (status === 'Approved') {
    await prisma.user.update({ where: { id: updated.userId }, data: { role: 'PROFESSIONAL' } });
  }
  res.json(updated);
}));

app.get('/api/admin/flags', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'ADMIN') { res.status(403).json({ error: 'Forbidden' }); return; }
  const flags = await prisma.flaggedPost.findMany();
  res.json({ data: flags });
}));

app.delete('/api/admin/flags/:id', requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'ADMIN') { res.status(403).json({ error: 'Forbidden' }); return; }
  const id = requireString(req.params.id, 'id', 1, 100);
  await prisma.flaggedPost.delete({ where: { id } });
  res.status(204).send();
}));

app.use(errorHandler);

export default app;

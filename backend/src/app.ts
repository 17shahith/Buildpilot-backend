import express, { Request, Response } from 'express';
import cors from 'cors';
import prisma from './database';

const app = express();

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const allowedOrigins = [
  'https://buildpilot-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    // Check if origin is localhost or 127.0.0.1 with any port
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    
    // Allow exact matches, Vercel subdomains, or localhost
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || isLocalhost) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Root status endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'Backend Running',
    timestamp: new Date().toISOString()
  });
});

// GET /api/health status check
app.get('/api/health', async (req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    // MongoDB ping check
    await prisma.$runCommandRaw({ ping: 1 });
    dbStatus = 'connected';
  } catch (error) {
    console.error('[Health Check] Database connectivity error:', error);
    dbStatus = 'error';
  }

  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    version: '1.0.0'
  });
});


// Mock database for Marketplace professionals
const professionals = [
  { id: '1', name: 'Ripon Ahmed', role: 'Architect / UI Designer', rating: 4.9, reviews: 142, rate: 85, location: 'San Francisco, CA', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Residential', 'Modern UI', 'Green Buildings'], verified: true },
  { id: '2', name: 'Sarah Connor', role: 'Structural Engineer', rating: 4.8, reviews: 98, rate: 95, location: 'Austin, TX', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Steel Frames', 'Retrofitting', 'Seismic Design'], verified: true },
  { id: '3', name: 'David Miller', role: 'General Contractor', rating: 4.7, reviews: 215, rate: 75, location: 'Seattle, WA', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Commercial', 'Renovations', 'Smart Home'], verified: true },
  { id: '4', name: 'Elena Rostova', role: 'Interior Designer', rating: 4.95, reviews: 88, rate: 90, location: 'New York, NY', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Minimalist', 'Lighting Design', 'Eco-friendly'], verified: true },
  { id: '5', name: 'James Carter', role: 'Electrician', rating: 4.85, reviews: 104, rate: 60, location: 'Chicago, IL', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Wiring', 'EV Chargers', 'Smart Lighting'], verified: false }
];

// Mock database for Properties
const properties = [
  { id: 'p1', title: 'The Obsidian Glass Villa', price: 1250000, type: 'Buy', rooms: '4 beds • 3.5 baths • 3,200 sqft', location: 'Beverly Hills, CA', image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800&h=500', verified: true, tags: ['Luxurious', 'Panoramic Views', 'Smart Home'] },
  { id: 'p2', title: 'Minimalist Urban Loft', price: 4200, type: 'Rent', rooms: '2 beds • 2 baths • 1,450 sqft', location: 'SoHo, New York', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800&h=500', verified: true, tags: ['Industrial', 'Exposed Brick', 'Gym Access'] },
  { id: 'p3', title: 'Forest Haven Cabin', price: 680000, type: 'Buy', rooms: '3 beds • 2 baths • 2,100 sqft', location: 'Portland, OR', image: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&q=80&w=800&h=500', verified: false, tags: ['Solar Powered', 'Rustic', 'Stream View'] }
];

// AI Estimation Route
app.post('/api/estimate', async (req: Request, res: Response) => {
  const { area, quality, floors, type } = req.body;

  const baseRate = type === 'renovation' ? 120 : 190;
  const qualityMultiplier = quality === 'luxury' ? 1.8 : quality === 'premium' ? 1.4 : 1.0;
  
  const estimatedCost = area * baseRate * qualityMultiplier * (1 + (floors - 1) * 0.15);

  const localMaterials = [
    { name: 'Cement (50kg bags)', qty: Math.round(area * 0.4 * qualityMultiplier), unitCost: 12 },
    { name: 'Bricks (Red clay)', qty: Math.round(area * 45 * qualityMultiplier), unitCost: 0.65 },
    { name: 'Steel rebars (tons)', qty: Number((area * 0.007 * qualityMultiplier).toFixed(2)), unitCost: 1100 },
    { name: 'Sand (tons)', qty: Math.round(area * 0.15 * qualityMultiplier), unitCost: 45 },
    { name: 'Aggregate (tons)', qty: Math.round(area * 0.18 * qualityMultiplier), unitCost: 55 },
    { name: 'Paint (litres)', qty: Math.round(area * 0.8 * (quality === 'luxury' ? 1.5 : 1)), unitCost: 8 }
  ];

  const localBreakdown = [
    { category: 'Excavation & Foundations', percentage: 15 },
    { category: 'Structural Frame & Pillars', percentage: 35 },
    { category: 'Brickwork & Plastering', percentage: 15 },
    { category: 'Flooring, Tiles & Tiling', percentage: 12 },
    { category: 'Electrical, Plumbing & HVAC', percentage: 13 },
    { category: 'Finishing & Painting', percentage: 10 }
  ].map(item => ({
    ...item,
    cost: Math.round(estimatedCost * (item.percentage / 100))
  }));

  const localResponse = {
    totalEstimate: Math.round(estimatedCost),
    materials: localMaterials,
    breakdown: localBreakdown,
    currency: 'USD',
    optimizations: [
      'Switching to AAC blocks instead of red bricks can save up to 8% of structural cost.',
      'Procuring aggregates directly from quarries reduces material delivery markups by 12%.',
      'Implementing high-grade fly-ash cement reduces thermal cracking and foundation cost by 4%'
    ]
  };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.log('[AI Estimator] GROQ_API_KEY not found in environment, using local programmatic calculator.');
    return res.json(localResponse);
  }

  try {
    const prompt = `You are a professional construction estimator. Compute a realistic bill of quantities and structural cost estimate for a construction project with:
- Area: ${area} square feet
- Specification Quality: ${quality} (choices: standard, premium, luxury)
- Number of floors: ${floors}
- Build Type: ${type} (choices: new, renovation)

You MUST respond with a JSON object following this EXACT schema, containing realistic calculated numbers:
{
  "totalEstimate": number (overall cost in USD),
  "materials": [
    { "name": string, "qty": number, "unitCost": number }
  ],
  "breakdown": [
    { "category": string, "percentage": number }
  ],
  "currency": "USD",
  "optimizations": [
    string (construction cost saving tips)
  ]
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are an AI estimator that outputs ONLY a valid JSON object matching the requested schema.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!groqResponse.ok) {
      throw new Error(`Groq API returned status ${groqResponse.status}`);
    }

    const responseData: any = await groqResponse.json();
    const content = responseData.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (typeof parsed.totalEstimate === 'number' && Array.isArray(parsed.materials)) {
        console.log('[AI Estimator] Dynamic estimate successfully generated using Groq AI.');
        if (Array.isArray(parsed.breakdown)) {
          parsed.breakdown = parsed.breakdown.map((item: any) => ({
            ...item,
            cost: item.cost || Math.round(parsed.totalEstimate * ((item.percentage || 0) / 100))
          }));
        }
        return res.json({
          totalEstimate: parsed.totalEstimate,
          materials: parsed.materials,
          breakdown: parsed.breakdown || localBreakdown,
          currency: parsed.currency || 'USD',
          optimizations: parsed.optimizations || localResponse.optimizations
        });
      }
    }
    throw new Error('Invalid JSON structure returned by Groq AI model');
  } catch (error: any) {
    console.error('[AI Estimator Error] Groq API call failed or timed out. Falling back to local calculator:', error?.message || error);
    return res.json(localResponse);
  }
});

// AI Image Defect Detection Route
app.post('/api/defect-detection', (req: Request, res: Response) => {
  const { imageUrl } = req.body;

  // Mock analysis logic based on simulated file name or URL
  const mockAnalysis = {
    defectDetected: true,
    severity: 'Medium',
    type: 'Structural Fissures',
    location: 'Concrete wall / Pillar junction',
    description: 'Hairline shearing crack due to minor structural settling or thermal contraction.',
    remedy: 'Inject low-viscosity epoxy resin and monitor for dynamic widening. If width exceeds 3mm, consult an engineer.',
    repairedCostEstimate: 280,
    confidenceRate: 94.6
  };

  res.json(mockAnalysis);
});

// GET Marketplace Professionals
app.get('/api/professionals', async (req: Request, res: Response) => {
  const { role, location, search } = req.query;
  try {
    const dbProfiles = await prisma.profile.findMany({
      include: { user: true }
    });

    if (dbProfiles && dbProfiles.length > 0) {
      let formatted = dbProfiles.map(p => ({
        id: p.id,
        name: p.name,
        role: p.roleTitle || 'Professional',
        rating: p.rating,
        reviews: p.reviewsCount,
        rate: p.hourlyRate || 0,
        location: p.location || '',
        image: p.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150',
        tags: p.tags,
        verified: p.verified
      }));

      if (role) {
        formatted = formatted.filter(p => p.role.toLowerCase().includes((role as string).toLowerCase()));
      }
      if (location) {
        formatted = formatted.filter(p => p.location.toLowerCase().includes((location as string).toLowerCase()));
      }
      if (search) {
        formatted = formatted.filter(p => 
          p.name.toLowerCase().includes((search as string).toLowerCase()) ||
          p.tags.some(t => t.toLowerCase().includes((search as string).toLowerCase()))
        );
      }
      return res.json(formatted);
    }
  } catch (error) {
    console.error('[Database API] Failed to query professionals from DB, falling back to mock data:', error);
  }

  let filtered = [...professionals];
  if (role) {
    filtered = filtered.filter(p => p.role.toLowerCase().includes((role as string).toLowerCase()));
  }
  if (location) {
    filtered = filtered.filter(p => p.location.toLowerCase().includes((location as string).toLowerCase()));
  }
  if (search) {
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes((search as string).toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes((search as string).toLowerCase()))
    );
  }
  res.json(filtered);
});

// GET Marketplace Properties
app.get('/api/properties', async (req: Request, res: Response) => {
  const { type, minPrice, maxPrice, search } = req.query;
  try {
    const dbProperties = await prisma.property.findMany();
    if (dbProperties && dbProperties.length > 0) {
      let formatted = dbProperties.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        type: p.type === 'BUY' ? 'Buy' : 'Rent',
        rooms: p.rooms,
        location: p.location,
        image: p.imageUrl,
        verified: p.verified,
        tags: p.tags
      }));

      if (type) {
        formatted = formatted.filter(p => p.type.toLowerCase() === (type as string).toLowerCase());
      }
      if (minPrice) {
        formatted = formatted.filter(p => p.price >= Number(minPrice));
      }
      if (maxPrice) {
        formatted = formatted.filter(p => p.price <= Number(maxPrice));
      }
      if (search) {
        formatted = formatted.filter(p => 
          p.title.toLowerCase().includes((search as string).toLowerCase()) ||
          p.location.toLowerCase().includes((search as string).toLowerCase())
        );
      }
      return res.json(formatted);
    }
  } catch (error) {
    console.error('[Database API] Failed to query properties from DB, falling back to mock data:', error);
  }

  let filtered = [...properties];
  if (type) {
    filtered = filtered.filter(p => p.type.toLowerCase() === (type as string).toLowerCase());
  }
  if (minPrice) {
    filtered = filtered.filter(p => p.price >= Number(minPrice));
  }
  if (maxPrice) {
    filtered = filtered.filter(p => p.price <= Number(maxPrice));
  }
  if (search) {
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes((search as string).toLowerCase()) ||
      p.location.toLowerCase().includes((search as string).toLowerCase())
    );
  }
  res.json(filtered);
});

// Route for generic chat assistant interactions
app.post('/api/chat', (req: Request, res: Response) => {
  const { message } = req.body;
  const lower = message.toLowerCase();

  let response = "I am BuildBridge AI, your construction copilot. Ask me about building costs, local regulations, contractors, material specifications, or AR setup!";

  if (lower.includes('cost') || lower.includes('estimate') || lower.includes('budget')) {
    response = "Building standard houses typically ranges from $120 to $250 per square foot depending on materials, finishes, and city codes. Use our AI Construction Estimator dashboard to get an exact itemized breakdown of cement, bricks, and custom flooring!";
  } else if (lower.includes('ar') || lower.includes('visual')) {
    response = "The AR Visualizer allows you to scan your rooms, auto-measure boundaries, and overlay custom wall paint, tiles, and furniture in real time using WebXR. Tap 'AR Home Visualiser' in the top navigation to start scanning your layout.";
  } else if (lower.includes('defect') || lower.includes('crack') || lower.includes('damage')) {
    response = "Got a crack or plaster issue? Upload a photo to our Defect Detector under the AI Estimator module. The AI classifies crack severity, provides repair instructions, and matches you with contractors nearby.";
  } else if (lower.includes('engineer') || lower.includes('architect') || lower.includes('contractor')) {
    response = "We have over 500+ verified architects, engineers, and general contractors on BuildBridge. Navigate to our Marketplace section, select a professional like Ripon Ahmed, and schedule a consultation direct through the calendar!";
  }

  res.json({ response });
});

// Auth Register endpoint
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password, role, name } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await prisma.user.create({
      data: {
        email,
        password, // In a real app we'd hash, but for demo we can save directly
        role,
        profile: {
          create: {
            name: name || email.split('@')[0],
            tags: []
          }
        }
      },
      include: { profile: true }
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: user.id, email: user.email, role: user.role, profile: user.profile }
    });
  } catch (error: any) {
    console.error('[Auth API] Register error:', error);
    res.status(201).json({
      message: 'Demo Registration Success (Database offline fallback)',
      user: { id: 'demo-user-id', email, role, profile: { name: name || 'Demo User' } }
    });
  }
});

// Auth Login endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      token: 'demo-jwt-token',
      user: { id: user.id, email: user.email, role: user.role, profile: user.profile }
    });
  } catch (error) {
    console.error('[Auth API] Login error:', error);
    if (email.includes('@') && password.length >= 6) {
      res.json({
        message: 'Demo Login Success (Database offline fallback)',
        token: 'demo-jwt-token',
        user: { id: 'demo-user-id', email, role: 'CLIENT', profile: { name: 'Demo Client User' } }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  }
});

// Auth Me endpoint
app.get('/api/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header provided' });
  }

  try {
    const firstUser = await prisma.user.findFirst({
      include: { profile: true }
    });

    if (firstUser) {
      return res.json({
        id: firstUser.id,
        email: firstUser.email,
        role: firstUser.role,
        profile: firstUser.profile
      });
    }
  } catch (error) {
    console.error('[Auth API] Auth me query error:', error);
  }

  res.json({
    id: 'demo-user-id',
    email: 'client@buildbridge.com',
    role: 'CLIENT',
    profile: {
      name: 'Ripon Ahmed',
      roleTitle: 'Architect / UI Designer',
      location: 'San Francisco, CA'
    }
  });
});

// Upload Endpoint
app.post('/api/upload', (req: Request, res: Response) => {
  res.json({
    status: 'success',
    url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800&h=500',
    fileName: 'uploaded_defect_scan.jpg',
    sizeBytes: 153600,
    timestamp: new Date().toISOString()
  });
});

export default app;

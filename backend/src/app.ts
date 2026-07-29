import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();

const allowedOrigins = [
  'https://buildpilot-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    // Allow exact matches or subdomains under vercel.app
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
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
app.post('/api/estimate', (req: Request, res: Response) => {
  const { area, quality, floors, type } = req.body;

  const baseRate = type === 'renovation' ? 120 : 190;
  const qualityMultiplier = quality === 'luxury' ? 1.8 : quality === 'premium' ? 1.4 : 1.0;
  
  const estimatedCost = area * baseRate * qualityMultiplier * (1 + (floors - 1) * 0.15);

  const materials = [
    { name: 'Cement (50kg bags)', qty: Math.round(area * 0.4 * qualityMultiplier), unitCost: 12 },
    { name: 'Bricks (Red clay)', qty: Math.round(area * 45 * qualityMultiplier), unitCost: 0.65 },
    { name: 'Steel rebars (tons)', qty: Number((area * 0.007 * qualityMultiplier).toFixed(2)), unitCost: 1100 },
    { name: 'Sand (tons)', qty: Math.round(area * 0.15 * qualityMultiplier), unitCost: 45 },
    { name: 'Aggregate (tons)', qty: Math.round(area * 0.18 * qualityMultiplier), unitCost: 55 },
    { name: 'Paint (litres)', qty: Math.round(area * 0.8 * (quality === 'luxury' ? 1.5 : 1)), unitCost: 8 }
  ];

  const breakdown = [
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

  res.json({
    totalEstimate: Math.round(estimatedCost),
    materials,
    breakdown,
    currency: 'USD',
    optimizations: [
      'Switching to AAC blocks instead of red bricks can save up to 8% of structural cost.',
      'Procuring aggregates directly from quarries reduces material delivery markups by 12%.',
      'Implementing high-grade fly-ash cement reduces thermal cracking and foundation cost by 4%.'
    ]
  });
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
app.get('/api/professionals', (req: Request, res: Response) => {
  const { role, location, search } = req.query;
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
app.get('/api/properties', (req: Request, res: Response) => {
  const { type, minPrice, maxPrice, search } = req.query;
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

export default app;

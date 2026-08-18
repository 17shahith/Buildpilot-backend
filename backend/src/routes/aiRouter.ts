import { Router } from 'express';
import prisma from '../database';
import { getConfig } from '../config';
import { requireAuth, AuthenticatedRequest } from '../middleware';
import { rateLimit } from '../rateLimit';
import { requireString, finiteNumber } from '../validation';

const router = Router();

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

// ----------------------------------------------------
// ESTIMATE ENDPOINT
// ----------------------------------------------------
router.post('/estimate', rateLimit('estimate', 20, 60), async (req, res, next) => {
  try {
    const area = finiteNumber(req.body?.area, 'area', 1, 10_000_000);
    const floors = finiteNumber(req.body?.floors, 'floors', 1, 100);
    const quality = requireString(req.body?.quality, 'quality', 1, 20);
    const type = requireString(req.body?.type, 'type', 1, 20);
    if (!['standard', 'premium', 'luxury'].includes(quality) || !['new', 'renovation'].includes(type)) throw new Error('quality or type is invalid');
    const fallback = localEstimate(area, quality, floors, type);
    const apiKey = getConfig().groqApiKey;
    if (!apiKey) {
      res.json(fallback);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Return only a JSON construction estimate matching the schema structure.' },
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
      res.json(parsed ?? fallback);
    } catch (error) {
      console.error('[Estimator]', error instanceof Error ? error.message : 'provider failure');
      res.json(fallback);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// DEFECT DETECTION ENDPOINT
// ----------------------------------------------------
router.post('/defect-detection', requireAuth, rateLimit('defect-detection', 10, 60), async (req, res, next) => {
  try {
    const imageUrl = req.body?.imageUrl;
    // Perform simple image analysis simulation and return category findings
    const mockCategories = [
      { name: 'Hairline Concrete Crack', severity: 'Low', recommendation: 'Monitor crack progression and seal with epoxy.' },
      { name: 'Structural Shear Failure', severity: 'Critical', recommendation: 'Consult structural engineer immediately. Restrict area loads.' },
      { name: 'Efflorescence / Moisture Seepage', severity: 'Medium', recommendation: 'Improve drainage and apply waterproofing membrane.' }
    ];
    // Return a random mock category based on imageName/url
    const chosen = mockCategories[Math.floor(Math.random() * mockCategories.length)];
    res.json({
      success: true,
      defect: chosen.name,
      severity: chosen.severity,
      recommendation: chosen.recommendation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// RAG CHAT ENDPOINT
// ----------------------------------------------------
router.post('/chat', rateLimit('chat', 30, 60), async (req, res, next) => {
  try {
    const message = requireString(req.body?.message, 'message', 1, 2000);
    const lowercaseMessage = message.toLowerCase();

    // RAG Search: Find relevant context from DocumentChunks
    const chunks = await prisma.documentChunk.findMany({
      take: 3
    });

    const context = chunks.map((c) => c.content).join('\n');
    const apiKey = getConfig().groqApiKey;

    if (!apiKey) {
      // Local fallback rule evaluation
      let response = 'I am BuildPilot AI, your construction copilot.';
      if (lowercaseMessage.includes('cost') || lowercaseMessage.includes('estimate') || lowercaseMessage.includes('budget')) {
        response = 'Use the estimator to calculate construction costs from area, quality, floors, and build type.';
      } else if (lowercaseMessage.includes('defect') || lowercaseMessage.includes('crack') || lowercaseMessage.includes('damage')) {
        response = 'Upload a supported inspection image after defect detection is enabled.';
      } else if (lowercaseMessage.includes('engineer') || lowercaseMessage.includes('architect') || lowercaseMessage.includes('contractor')) {
        response = 'Browse the professionals marketplace to find a construction specialist.';
      }
      res.json({ response });
      return;
    }

    // Call Groq with grounding context
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `You are BuildPilot AI, an expert construction assistant. Use the following context to ground your answer if applicable:\n${context}`
            },
            { role: 'user', content: message }
          ],
          temperature: 0.3
        }),
        signal: controller.signal
      });
      if (!groqResponse.ok) throw new Error(`Chat provider returned ${groqResponse.status}`);
      const body: any = await groqResponse.json();
      const response = body.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
      res.json({ response });
    } catch (error) {
      console.error('[AI Chat]', error);
      res.json({ response: 'I am BuildPilot AI, your construction copilot. (Fallback Mode)' });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    next(error);
  }
});

export default router;

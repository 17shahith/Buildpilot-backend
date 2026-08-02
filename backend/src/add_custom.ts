import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) throw new Error('SEED_PASSWORD must be set and at least 12 characters.');
  const passwordHash = await hashPassword(seedPassword);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: 'zzz@buildbridge.com', password: passwordHash, role: 'CLIENT' } });
    const profile = await tx.profile.create({ data: { name: 'xxx', userId: user.id, roleTitle: 'Consultant', location: 'Global', hourlyRate: 50, tags: ['Custom', 'Sample'] } });
    const property = await tx.property.create({ data: { title: 'yyy', price: 500000, type: 'BUY', rooms: '3 beds • 2 baths', location: 'Custom Location', imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800&h=500', tags: ['Custom', 'Property'] } });
    return { user, profile, property };
  });
  console.log('Created User:', result.user.email);
  console.log('Created Profile:', result.profile.name);
  console.log('Created Property:', result.property.title);
}

main().catch((error) => {
  console.error('Error inserting custom data:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());

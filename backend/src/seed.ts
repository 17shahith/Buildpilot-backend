import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.SEED_CONFIRM !== 'I_UNDERSTAND') {
    throw new Error('Refusing destructive seed. Set SEED_CONFIRM=I_UNDERSTAND in a non-production environment.');
  }
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) throw new Error('SEED_PASSWORD must be at least 12 characters.');
  const passwordHash = await hashPassword(seedPassword);

    await prisma.booking.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.property.deleteMany({});

    await prisma.property.createMany({ data: [
      { title: 'The Obsidian Glass Villa', price: 1250000, type: 'BUY', rooms: '4 beds • 3.5 baths • 3,200 sqft', location: 'Beverly Hills, CA', imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800&h=500', verified: true, tags: ['Luxurious', 'Panoramic Views', 'Smart Home'] },
      { title: 'Minimalist Urban Loft', price: 4200, type: 'RENT', rooms: '2 beds • 2 baths • 1,450 sqft', location: 'SoHo, New York', imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800&h=500', verified: true, tags: ['Industrial', 'Exposed Brick', 'Gym Access'] },
      { title: 'Forest Haven Cabin', price: 680000, type: 'BUY', rooms: '3 beds • 2 baths • 2,100 sqft', location: 'Portland, OR', imageUrl: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&q=80&w=800&h=500', verified: false, tags: ['Solar Powered', 'Rustic', 'Stream View'] }
    ] });

    const professionals = [
      { email: 'ripon@buildbridge.com', name: 'Ripon Ahmed', roleTitle: 'Architect / UI Designer', rating: 4.9, reviewsCount: 142, hourlyRate: 85, location: 'San Francisco, CA', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Residential', 'Modern UI', 'Green Buildings'], verified: true },
      { email: 'sarah@buildbridge.com', name: 'Sarah Connor', roleTitle: 'Structural Engineer', rating: 4.8, reviewsCount: 98, hourlyRate: 95, location: 'Austin, TX', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Steel Frames', 'Retrofitting', 'Seismic Design'], verified: true },
      { email: 'david@buildbridge.com', name: 'David Miller', roleTitle: 'General Contractor', rating: 4.7, reviewsCount: 215, hourlyRate: 75, location: 'Seattle, WA', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Commercial', 'Renovations', 'Smart Home'], verified: true },
      { email: 'john@example.com', name: 'John', roleTitle: 'Senior Architect', rating: 5.0, reviewsCount: 42, hourlyRate: 110, location: 'New York, NY', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150&h=150', tags: ['Luxury Homes', 'Modern Design'], verified: true }
    ];

    for (const professional of professionals) {
      const user = await prisma.user.create({ data: { email: professional.email, password: passwordHash, role: 'PROFESSIONAL' } });
      await prisma.profile.create({ data: { name: professional.name, userId: user.id, roleTitle: professional.roleTitle, location: professional.location, hourlyRate: professional.hourlyRate, rating: professional.rating, reviewsCount: professional.reviewsCount, verified: professional.verified, tags: professional.tags, avatarUrl: professional.avatarUrl } });
    }
  console.log('Seed completed successfully.');
}

main().catch((error) => {
  console.error('Error during seeding:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());

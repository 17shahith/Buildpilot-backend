import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing existing data...');
  await prisma.booking.deleteMany({});
  await prisma.profile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.property.deleteMany({});

  console.log('Seeding Properties...');
  await prisma.property.createMany({
    data: [
      {
        title: 'The Obsidian Glass Villa',
        price: 1250000,
        type: 'BUY',
        rooms: '4 beds • 3.5 baths • 3,200 sqft',
        location: 'Beverly Hills, CA',
        imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800&h=500',
        verified: true,
        tags: ['Luxurious', 'Panoramic Views', 'Smart Home']
      },
      {
        title: 'Minimalist Urban Loft',
        price: 4200,
        type: 'RENT',
        rooms: '2 beds • 2 baths • 1,450 sqft',
        location: 'SoHo, New York',
        imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=800&h=500',
        verified: true,
        tags: ['Industrial', 'Exposed Brick', 'Gym Access']
      },
      {
        title: 'Forest Haven Cabin',
        price: 680000,
        type: 'BUY',
        rooms: '3 beds • 2 baths • 2,100 sqft',
        location: 'Portland, OR',
        imageUrl: 'https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&q=80&w=800&h=500',
        verified: false,
        tags: ['Solar Powered', 'Rustic', 'Stream View']
      }
    ]
  });

  console.log('Seeding Users & Profiles...');
  const sampleProfessionals = [
    {
      email: 'ripon@buildbridge.com',
      name: 'Ripon Ahmed',
      roleTitle: 'Architect / UI Designer',
      rating: 4.9,
      reviewsCount: 142,
      hourlyRate: 85,
      location: 'San Francisco, CA',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150',
      tags: ['Residential', 'Modern UI', 'Green Buildings'],
      verified: true
    },
    {
      email: 'sarah@buildbridge.com',
      name: 'Sarah Connor',
      roleTitle: 'Structural Engineer',
      rating: 4.8,
      reviewsCount: 98,
      hourlyRate: 95,
      location: 'Austin, TX',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150',
      tags: ['Steel Frames', 'Retrofitting', 'Seismic Design'],
      verified: true
    },
    {
      email: 'david@buildbridge.com',
      name: 'David Miller',
      roleTitle: 'General Contractor',
      rating: 4.7,
      reviewsCount: 215,
      hourlyRate: 75,
      location: 'Seattle, WA',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150',
      tags: ['Commercial', 'Renovations', 'Smart Home'],
      verified: true
    }
  ];

  for (const prof of sampleProfessionals) {
    const user = await prisma.user.create({
      data: {
        email: prof.email,
        password: 'hashedpassword123', // Demo placeholder
        role: 'PROFESSIONAL'
      }
    });

    await prisma.profile.create({
      data: {
        name: prof.name,
        userId: user.id,
        roleTitle: prof.roleTitle,
        location: prof.location,
        hourlyRate: prof.hourlyRate,
        rating: prof.rating,
        reviewsCount: prof.reviewsCount,
        verified: prof.verified,
        tags: prof.tags,
        avatarUrl: prof.avatarUrl
      }
    });
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

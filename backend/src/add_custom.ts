import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inserting custom sample data...');

  // Create a new User
  const user = await prisma.user.create({
    data: {
      email: 'zzz@buildbridge.com',
      password: 'custompassword123',
      role: 'CLIENT'
    }
  });
  console.log('Created User with email:', user.email);

  // Create corresponding Profile
  const profile = await prisma.profile.create({
    data: {
      name: 'xxx',
      userId: user.id,
      roleTitle: 'Consultant',
      location: 'Global',
      hourlyRate: 50.0,
      tags: ['Custom', 'Sample']
    }
  });
  console.log('Created Profile with name:', profile.name);

  // Create Property
  const property = await prisma.property.create({
    data: {
      title: 'yyy',
      price: 500000,
      type: 'BUY',
      rooms: '3 beds • 2 baths',
      location: 'Custom Location',
      imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=800&h=500',
      tags: ['Custom', 'Property']
    }
  });
  console.log('Created Property with title:', property.title);

  console.log('Custom data inserted successfully.');
}

main()
  .catch((e) => {
    console.error('Error inserting custom data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

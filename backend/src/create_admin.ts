import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@test.com';
  const plainPassword = 'AdminPass_2026!'; 
  const passwordHash = await hashPassword(plainPassword);
  
  // Upsert the admin user to avoid unique constraint violation if it already exists
  const user = await prisma.user.upsert({
    where: { email },
    update: { password: passwordHash, role: 'ADMIN' },
    create: { email, password: passwordHash, role: 'ADMIN' },
  });
  
  console.log(`Admin user created/updated successfully!`);
  console.log(`Email: ${user.email}`);
  console.log(`Password: test`);
}

main().catch((error) => {
  console.error('Error creating admin:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());

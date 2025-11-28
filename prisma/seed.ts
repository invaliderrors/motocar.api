
import * as bcrypt from 'bcrypt';
import { PrismaClient, StoreStatus, UserRole } from '../src/prisma/generated/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting multi-store seed...');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. CREATE ADMIN USER (Global Access)
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n👤 Creating admin user...');

  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await prisma.employee.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      name: 'Administrador General',
      username: 'admin',
      email: 'admin@motofacil.com',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      storeId: null, // Admin has no store restriction
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Created admin: ${admin.name} (${admin.username})`);
  console.log(`     📧 Email: ${admin.email}`);
  console.log(`     🔑 Password: Admin123!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

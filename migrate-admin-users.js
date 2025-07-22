const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateAdminUsers() {
  try {
    console.log('Starting migration of ADMIN users to SUPER_ADMIN...');
    
    // Find all users with ADMIN role
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN'
      }
    });
    
    console.log(`Found ${adminUsers.length} ADMIN users to migrate`);
    
    if (adminUsers.length === 0) {
      console.log('No ADMIN users found. Migration complete.');
      return;
    }
    
    // Update all ADMIN users to SUPER_ADMIN
    const updateResult = await prisma.user.updateMany({
      where: {
        role: 'ADMIN'
      },
      data: {
        role: 'SUPER_ADMIN'
      }
    });
    
    console.log(`Successfully migrated ${updateResult.count} users from ADMIN to SUPER_ADMIN`);
    
    // Verify the migration
    const remainingAdminUsers = await prisma.user.count({
      where: {
        role: 'ADMIN'
      }
    });
    
    if (remainingAdminUsers === 0) {
      console.log('✅ Migration completed successfully. No ADMIN users remaining.');
    } else {
      console.warn(`⚠️  Warning: ${remainingAdminUsers} ADMIN users still remain.`);
    }
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateAdminUsers();
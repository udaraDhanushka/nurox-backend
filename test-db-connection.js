const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...');

    // Test basic connection
    await prisma.$connect();
    console.log('✅ Successfully connected to database');

    // Test a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Database query successful:', result);

    // Check if users table exists
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('❌ Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

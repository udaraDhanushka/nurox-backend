const { Client } = require('pg');

// Database connection from the backend .env file
const client = new Client({
  connectionString:
    'postgresql://postgres.dksvomenfhqajbatyyvc:Nurox@123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres',
});

async function checkDatabase() {
  try {
    await client.connect();
    console.log('🔍 Connected to database successfully!');

    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does not exist');
      return;
    }

    console.log('✅ Users table exists');

    // Get total user count
    const totalUsers = await client.query('SELECT COUNT(*) FROM users');
    console.log(`📊 Total users in database: ${totalUsers.rows[0].count}`);

    if (totalUsers.rows[0].count === '0') {
      console.log('❌ No users found in database');
      return;
    }

    // Get user breakdown by role
    const usersByRole = await client.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);

    console.log('\n👥 Users by role:');
    usersByRole.rows.forEach((row) => {
      console.log(`  ${row.role}: ${row.count}`);
    });

    // Get sample users with basic info (first 5)
    const sampleUsers = await client.query(`
      SELECT id, email, "firstName", "lastName", role, "isActive", "emailVerified", "createdAt", password
      FROM users 
      LIMIT 5
    `);

    console.log('\n🔍 Sample users:');
    sampleUsers.rows.forEach((user, index) => {
      console.log(
        `  ${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`
      );
      console.log(`     Role: ${user.role}`);
      console.log(`     Active: ${user.isActive}`);
      console.log(`     Email Verified: ${user.emailVerified}`);
      console.log(`     Created: ${user.createdAt}`);
      console.log(`     Password Hash: ${user.password.substring(0, 20)}...`);
      console.log('');
    });

    // Check password format
    const passwordStats = await client.query('SELECT password FROM users');

    console.log('\n🔐 Password format analysis:');
    const bcryptPattern = /^\$2[ayb]\$[0-9]{2}\$/;
    const bcryptPasswords = passwordStats.rows.filter((u) =>
      bcryptPattern.test(u.password)
    );

    console.log(`  Total passwords: ${passwordStats.rows.length}`);
    console.log(`  Bcrypt hashed passwords: ${bcryptPasswords.length}`);
    console.log(
      `  Other format passwords: ${passwordStats.rows.length - bcryptPasswords.length}`
    );

    if (bcryptPasswords.length > 0) {
      console.log(
        `  Sample bcrypt hash: ${bcryptPasswords[0].password.substring(0, 30)}...`
      );
    }

    // Check active vs inactive users
    const activeUsers = await client.query(
      'SELECT COUNT(*) FROM users WHERE "isActive" = true'
    );
    const inactiveUsers = await client.query(
      'SELECT COUNT(*) FROM users WHERE "isActive" = false'
    );

    console.log('\n📈 User status:');
    console.log(`  Active users: ${activeUsers.rows[0].count}`);
    console.log(`  Inactive users: ${inactiveUsers.rows[0].count}`);

    // Check for any specific user accounts that might be test accounts
    const testAccounts = await client.query(`
      SELECT email, "firstName", "lastName", role, "isActive", "createdAt"
      FROM users 
      WHERE email LIKE '%test%' OR email LIKE '%demo%' OR "firstName" LIKE '%test%' OR "firstName" LIKE '%demo%'
    `);

    if (testAccounts.rows.length > 0) {
      console.log('\n🧪 Test/Demo accounts found:');
      testAccounts.rows.forEach((user, index) => {
        console.log(
          `  ${index + 1}. ${user.firstName} ${user.lastName} (${user.email}) - ${user.role}`
        );
      });
    }

    await client.end();
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
  }
}

checkDatabase();

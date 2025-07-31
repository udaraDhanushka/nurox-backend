const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('🚀 Creating test users for Nurox system...\n');

    // Hash password for all test users
    const hashedPassword = await bcrypt.hash('admin123456', 12);

    // 1. Create Super Admin
    console.log('👑 Creating Super Admin...');
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@nurox.com' },
      update: {},
      create: {
        email: 'superadmin@nurox.com',
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: 'SUPER_ADMIN',
        phone: '+1234567890',
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    console.log(`✅ Super Admin created: ${superAdmin.email}`);

    // 2. Create a test Hospital
    console.log('\n🏥 Creating test hospital...');
    const testHospital = await prisma.hospital.upsert({
      where: { registrationNumber: 'HOSP001' },
      update: {},
      create: {
        name: 'Nurox General Hospital',
        registrationNumber: 'HOSP001',
        address: '123 Medical Center Drive, Healthcare City',
        phone: '+1234567891',
        email: 'admin@nuroxhospital.com',
        website: 'https://nuroxhospital.com',
        description:
          'Premier healthcare facility with advanced medical services',
        specialties: [
          'Cardiology',
          'Neurology',
          'Pediatrics',
          'Emergency Medicine',
          'Surgery',
        ],
        bedCount: 200,
        emergencyServices: true,
        licenseNumber: 'LIC-HOSP-001',
        licenseExpiry: new Date('2025-12-31'),
        accreditation: 'Joint Commission Accredited',
        contactPerson: 'Dr. Jane Smith',
        contactPhone: '+1234567892',
        contactEmail: 'jane.smith@nuroxhospital.com',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Hospital created: ${testHospital.name}`);

    // 3. Create Hospital Admin
    console.log('\n👨‍💼 Creating Hospital Admin...');
    const hospitalAdmin = await prisma.user.upsert({
      where: { email: 'hospitaladmin@nurox.com' },
      update: {},
      create: {
        email: 'hospitaladmin@nurox.com',
        password: hashedPassword,
        firstName: 'Hospital',
        lastName: 'Administrator',
        role: 'HOSPITAL_ADMIN',
        phone: '+1234567893',
        hospitalId: testHospital.id,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    console.log(`✅ Hospital Admin created: ${hospitalAdmin.email}`);

    // 4. Create a test Pharmacy
    console.log('\n💊 Creating test pharmacy...');
    const testPharmacy = await prisma.pharmacy.upsert({
      where: { registrationNumber: 'PHARM001' },
      update: {},
      create: {
        name: 'Nurox Pharmacy',
        registrationNumber: 'PHARM001',
        address: '456 Pharmacy Street, Medical District',
        phone: '+1234567894',
        email: 'admin@nuroxpharmacy.com',
        website: 'https://nuroxpharmacy.com',
        description: 'Full-service pharmacy with 24/7 availability',
        operatingHours: {
          monday: '24/7',
          tuesday: '24/7',
          wednesday: '24/7',
          thursday: '24/7',
          friday: '24/7',
          saturday: '24/7',
          sunday: '24/7',
        },
        licenseNumber: 'LIC-PHARM-001',
        licenseExpiry: new Date('2025-12-31'),
        contactPerson: 'PharmD John Doe',
        contactPhone: '+1234567895',
        contactEmail: 'john.doe@nuroxpharmacy.com',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Pharmacy created: ${testPharmacy.name}`);

    // 5. Create Pharmacy Admin
    console.log('\n💊 Creating Pharmacy Admin...');
    const pharmacyAdmin = await prisma.user.upsert({
      where: { email: 'pharmacyadmin@nurox.com' },
      update: {},
      create: {
        email: 'pharmacyadmin@nurox.com',
        password: hashedPassword,
        firstName: 'Pharmacy',
        lastName: 'Administrator',
        role: 'PHARMACY_ADMIN',
        phone: '+1234567896',
        pharmacyId: testPharmacy.id,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    console.log(`✅ Pharmacy Admin created: ${pharmacyAdmin.email}`);

    // 6. Create a test Laboratory
    console.log('\n🔬 Creating test laboratory...');
    const testLab = await prisma.laboratory.upsert({
      where: { registrationNumber: 'LAB001' },
      update: {},
      create: {
        name: 'Nurox Diagnostic Laboratory',
        registrationNumber: 'LAB001',
        address: '789 Lab Sciences Boulevard, Research Park',
        phone: '+1234567897',
        email: 'admin@nuroxlab.com',
        website: 'https://nuroxlab.com',
        description:
          'Advanced diagnostic laboratory with state-of-the-art equipment',
        testTypes: [
          'Blood Tests',
          'Urine Analysis',
          'X-Ray',
          'MRI',
          'CT Scan',
          'Pathology',
        ],
        operatingHours: {
          monday: '6:00 AM - 10:00 PM',
          tuesday: '6:00 AM - 10:00 PM',
          wednesday: '6:00 AM - 10:00 PM',
          thursday: '6:00 AM - 10:00 PM',
          friday: '6:00 AM - 10:00 PM',
          saturday: '8:00 AM - 6:00 PM',
          sunday: '8:00 AM - 4:00 PM',
        },
        licenseNumber: 'LIC-LAB-001',
        licenseExpiry: new Date('2025-12-31'),
        accreditation: 'CAP Accredited',
        contactPerson: 'Dr. Maria Rodriguez',
        contactPhone: '+1234567898',
        contactEmail: 'maria.rodriguez@nuroxlab.com',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Laboratory created: ${testLab.name}`);

    // 7. Create Lab Admin
    console.log('\n🔬 Creating Lab Admin...');
    const labAdmin = await prisma.user.upsert({
      where: { email: 'labadmin@nurox.com' },
      update: {},
      create: {
        email: 'labadmin@nurox.com',
        password: hashedPassword,
        firstName: 'Laboratory',
        lastName: 'Administrator',
        role: 'LAB_ADMIN',
        phone: '+1234567899',
        laboratoryId: testLab.id,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    console.log(`✅ Lab Admin created: ${labAdmin.email}`);

    // 8. Create Insurance Company
    console.log('\n🛡️ Creating test insurance company...');
    const testInsurance = await prisma.insuranceCompany.upsert({
      where: { registrationNumber: 'INS001' },
      update: {},
      create: {
        name: 'Nurox Health Insurance',
        registrationNumber: 'INS001',
        address: '321 Insurance Plaza, Financial District',
        phone: '+1234567800',
        email: 'admin@nuroxinsurance.com',
        website: 'https://nuroxinsurance.com',
        description: 'Comprehensive health insurance coverage',
        coverageTypes: [
          'Health',
          'Dental',
          'Vision',
          'Prescription',
          'Emergency',
        ],
        licenseNumber: 'LIC-INS-001',
        licenseExpiry: new Date('2025-12-31'),
        contactPerson: 'Sarah Johnson',
        contactPhone: '+1234567801',
        contactEmail: 'sarah.johnson@nuroxinsurance.com',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Insurance Company created: ${testInsurance.name}`);

    // 9. Create Insurance Admin
    console.log('\n🛡️ Creating Insurance Admin...');
    const insuranceAdmin = await prisma.user.upsert({
      where: { email: 'insuranceadmin@nurox.com' },
      update: {},
      create: {
        email: 'insuranceadmin@nurox.com',
        password: hashedPassword,
        firstName: 'Insurance',
        lastName: 'Administrator',
        role: 'INSURANCE_ADMIN',
        phone: '+1234567802',
        insuranceId: testInsurance.id,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    console.log(`✅ Insurance Admin created: ${insuranceAdmin.email}`);

    // 10. Create a Test Doctor (pending verification)
    console.log('\n👨‍⚕️ Creating test doctor...');
    const testDoctor = await prisma.user.upsert({
      where: { email: 'doctor@nurox.com' },
      update: {},
      create: {
        email: 'doctor@nurox.com',
        password: hashedPassword,
        firstName: 'Dr. Michael',
        lastName: 'Thompson',
        role: 'DOCTOR',
        phone: '+1234567803',
        hospitalId: testHospital.id,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        doctorProfile: {
          create: {
            specialization: 'Cardiology',
            licenseNumber: 'DOC-001-2024',
            consultationFee: 150.0,
            experience: 8,
            qualifications: ['MD', 'FACC', 'Board Certified Cardiologist'],
            availableHours: {
              monday: '9:00 AM - 5:00 PM',
              tuesday: '9:00 AM - 5:00 PM',
              wednesday: '9:00 AM - 5:00 PM',
              thursday: '9:00 AM - 5:00 PM',
              friday: '9:00 AM - 3:00 PM',
            },
            rating: 4.8,
            reviewCount: 156,
            isVerified: false,
            verificationStatus: 'PENDING',
            verificationDocuments: [
              'medical_license.pdf',
              'board_certification.pdf',
            ],
          },
        },
      },
    });
    console.log(
      `✅ Doctor created: ${testDoctor.email} (Pending verification)`
    );

    // 11. Create a Test Patient
    console.log('\n👤 Creating test patient...');
    const testPatient = await prisma.user.upsert({
      where: { email: 'patient@nurox.com' },
      update: {},
      create: {
        email: 'patient@nurox.com',
        password: hashedPassword,
        firstName: 'Alice',
        lastName: 'Wilson',
        role: 'PATIENT',
        phone: '+1234567804',
        dateOfBirth: new Date('1990-05-15'),
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        patientProfile: {
          create: {
            emergencyContact: 'Robert Wilson (Husband)',
            emergencyPhone: '+1234567805',
            bloodType: 'A+',
            height: 165.0,
            weight: 65.0,
            occupation: 'Software Engineer',
            address: '123 Patient Street, Residential Area',
            city: 'Healthcare City',
            zipCode: '12345',
            country: 'USA',
            insuranceProvider: 'Nurox Health Insurance',
            insuranceNumber: 'NHS-2024-001',
          },
        },
      },
    });
    console.log(`✅ Patient created: ${testPatient.email}`);

    // 12. Create a Test Pharmacist
    console.log('\n💊 Creating test pharmacist...');
    const testPharmacist = await prisma.user.upsert({
      where: { email: 'pharmacist@nurox.com' },
      update: {},
      create: {
        email: 'pharmacist@nurox.com',
        password: hashedPassword,
        firstName: 'PharmD Lisa',
        lastName: 'Chen',
        role: 'PHARMACIST',
        phone: '+1234567806',
        pharmacyId: testPharmacy.id,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        pharmacistProfile: {
          create: {
            licenseNumber: 'PHARM-001-2024',
            pharmacyAffiliation: 'Nurox Pharmacy',
            pharmacyAddress: '456 Pharmacy Street, Medical District',
            workingHours: {
              monday: '8:00 AM - 8:00 PM',
              tuesday: '8:00 AM - 8:00 PM',
              wednesday: '8:00 AM - 8:00 PM',
              thursday: '8:00 AM - 8:00 PM',
              friday: '8:00 AM - 8:00 PM',
              saturday: '9:00 AM - 6:00 PM',
              sunday: '10:00 AM - 4:00 PM',
            },
            isVerified: true,
          },
        },
      },
    });
    console.log(`✅ Pharmacist created: ${testPharmacist.email}`);

    // 13. Create a Test MLT
    console.log('\n🔬 Creating test MLT...');
    const testMLT = await prisma.user.upsert({
      where: { email: 'mlt@nurox.com' },
      update: {},
      create: {
        email: 'mlt@nurox.com',
        password: hashedPassword,
        firstName: 'David',
        lastName: 'Martinez',
        role: 'MLT',
        phone: '+1234567807',
        laboratoryId: testLab.id,
        isActive: true,
        emailVerified: true,
        phoneVerified: true,
        mltProfile: {
          create: {
            licenseNumber: 'MLT-001-2024',
            certifications: [
              'ASCP Certified',
              'Phlebotomy Certified',
              'Clinical Chemistry',
            ],
            specializations: [
              'Hematology',
              'Clinical Chemistry',
              'Microbiology',
            ],
            workingHours: {
              monday: '7:00 AM - 7:00 PM',
              tuesday: '7:00 AM - 7:00 PM',
              wednesday: '7:00 AM - 7:00 PM',
              thursday: '7:00 AM - 7:00 PM',
              friday: '7:00 AM - 7:00 PM',
              saturday: '8:00 AM - 4:00 PM',
            },
            isVerified: true,
          },
        },
      },
    });
    console.log(`✅ MLT created: ${testMLT.email}`);

    console.log('\n📋 Test Users Summary:');
    console.log('='.repeat(50));
    console.log(`👑 Super Admin: superadmin@nurox.com`);
    console.log(`🏥 Hospital Admin: hospitaladmin@nurox.com`);
    console.log(`💊 Pharmacy Admin: pharmacyadmin@nurox.com`);
    console.log(`🔬 Lab Admin: labadmin@nurox.com`);
    console.log(`🛡️ Insurance Admin: insuranceadmin@nurox.com`);
    console.log(`👨‍⚕️ Doctor: doctor@nurox.com (Pending verification)`);
    console.log(`👤 Patient: patient@nurox.com`);
    console.log(`💊 Pharmacist: pharmacist@nurox.com`);
    console.log(`🔬 MLT: mlt@nurox.com`);
    console.log('='.repeat(50));
    console.log(`🔑 Password for all accounts: admin123456`);
    console.log('\n✅ All test users and organizations created successfully!');
  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createTestUsers();

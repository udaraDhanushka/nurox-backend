# Nurox Integration Setup Guide

## Quick Fix for Current Error

The backend server error has been fixed! The issue was a missing `validateRequest` middleware that has now been added.

## Database Migration Required

Since we've extended the database schema with new models, you need to run a migration:

```bash
cd /home/udara/Documents/CCCU/nurox-backend

# Generate Prisma client with new models
npx prisma generate

# Create and apply migration
npx prisma migrate dev --name "add_organizations_and_roles"

# (Optional) View the database in Prisma Studio
npx prisma studio
```

## Environment Setup

Make sure you have these environment variables in your `.env` file:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/nurox_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-refresh-secret-here"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# CORS
CORS_ORIGIN="http://localhost:3000,http://localhost:8081"

# Other settings
PORT=3000
NODE_ENV=development
BCRYPT_ROUNDS=12
```

## Starting the Services

1. **Backend** (run from nurox-backend directory):

```bash
npm run dev
```

2. **Dashboard** (run from nurox_dashboard directory):

```bash
npm run dev
```

3. **Mobile App** (run from nurox-mobile directory):

```bash
npm start
```

## Testing the Integration

### 1. Create Super Admin User

First, register a super admin user through the API:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@nurox.com",
    "password": "admin123456",
    "firstName": "Super",
    "lastName": "Admin",
    "role": "SUPER_ADMIN"
  }'
```

### 2. Login to Dashboard

- Open http://localhost:3000 (dashboard)
- Login with admin@nurox.com / admin123456
- You should see the Super Admin Dashboard

### 3. Create a Hospital

- In the dashboard, click "Add Organization"
- Create a new hospital

### 4. Register a Doctor

- Use the mobile app or API to register a doctor
- Select the hospital you created
- The hospital admin will receive a verification request

### 5. Test Real-time Updates

- Make changes in one app (dashboard/mobile)
- Verify they appear instantly in the other app

## Key Features to Test

1. **Multi-role Authentication**: Try logging in with different roles
2. **Organization Management**: Create/edit hospitals, pharmacies, labs
3. **Doctor Verification**: Hospital admin approving doctor requests
4. **Real-time Notifications**: Changes appearing instantly across apps
5. **Role-based Access**: Different users seeing different data

## Troubleshooting

### Backend Won't Start

- Check if PostgreSQL is running
- Verify DATABASE_URL in .env
- Run `npm install` to ensure dependencies

### Database Issues

- Run `npx prisma migrate reset` to reset database
- Check PostgreSQL logs for connection issues

### Socket Connection Issues

- Verify CORS_ORIGIN includes your frontend URLs
- Check browser console for socket errors

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dashboard     │    │     Backend     │    │   Mobile App    │
│  (Next.js)      │◄──►│   (Express)     │◄──►│   (React Native)│
│                 │    │                 │    │                 │
│ • Super Admin   │    │ • REST APIs     │    │ • Patients      │
│ • Hospital Admin│    │ • Socket.IO     │    │ • Doctors       │
│ • Org Management│    │ • Real-time     │    │ • Pharmacists   │
└─────────────────┘    │ • Auth & RBAC   │    │ • MLTs          │
                       └─────────────────┘    └─────────────────┘
                               │
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       │   Database      │
                       │                 │
                       │ • Users         │
                       │ • Organizations │
                       │ • Medical Data  │
                       └─────────────────┘
```

The integration is now complete and ready for testing!

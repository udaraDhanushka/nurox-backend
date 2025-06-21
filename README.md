# Nurox Healthcare Backend API

A comprehensive healthcare management backend API built with Node.js, Express, Prisma, and PostgreSQL. This backend supports the Nurox mobile healthcare application with features for patients, doctors, and pharmacists.

## Features

### 🏥 Core Healthcare Features
- **User Management**: Multi-role authentication (Patient, Doctor, Pharmacist, Admin)
- **Appointment System**: Booking, scheduling, and management
- **Prescription Management**: Digital prescriptions with OCR support
- **Lab Results**: Test ordering and result management
- **Medical Records**: Comprehensive patient health records
- **Pharmacy Integration**: Inventory management and prescription dispensing

### 🔧 Technical Features
- **Real-time Communication**: Socket.IO for live updates
- **File Upload & Processing**: Image handling with OCR capabilities
- **Payment Processing**: Stripe integration for secure payments
- **Notification System**: Real-time and email notifications
- **Analytics Dashboard**: Role-based analytics and insights
- **API Documentation**: Comprehensive REST API endpoints

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **File Processing**: Sharp, Multer, Tesseract.js (OCR)
- **Payment**: Stripe
- **Real-time**: Socket.IO
- **Email**: Nodemailer
- **Validation**: Joi
- **Logging**: Winston

## Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database
- Stripe account (for payments)
- SMTP server (for emails)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd nurox-backend
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run database migrations
   npm run prisma:migrate
   
   # (Optional) Seed database
   npm run prisma:seed
   ```

4. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

The API will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/nurox_healthcare"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"

# Server
NODE_ENV="development"
PORT=3000

# CORS
CORS_ORIGIN="http://localhost:8081"

# Stripe (for payments)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

See `.env.example` for all available configuration options.

## API Endpoints

### Authentication
```
POST /api/auth/register     - Register new user
POST /api/auth/login        - User login
POST /api/auth/logout       - User logout
GET  /api/auth/me          - Get current user
POST /api/auth/refresh-token - Refresh access token
```

### Users
```
GET  /api/users/profile            - Get user profile
PUT  /api/users/profile            - Update profile
PUT  /api/users/patient-profile    - Update patient profile
PUT  /api/users/doctor-profile     - Update doctor profile
PUT  /api/users/pharmacist-profile - Update pharmacist profile
```

### Appointments
```
GET  /api/appointments             - Get appointments
POST /api/appointments             - Create appointment
GET  /api/appointments/:id         - Get specific appointment
PUT  /api/appointments/:id         - Update appointment
DELETE /api/appointments/:id       - Cancel appointment
GET  /api/appointments/doctors/list - Get available doctors
```

### Prescriptions
```
GET  /api/prescriptions            - Get prescriptions
POST /api/prescriptions            - Create prescription
GET  /api/prescriptions/:id        - Get specific prescription
PUT  /api/prescriptions/:id/status - Update prescription status
POST /api/prescriptions/ocr/process - Process OCR prescription
```

### Medicines
```
GET  /api/medicines                - Get medicines
POST /api/medicines                - Add medicine
GET  /api/medicines/suggestions    - Get medicine suggestions
POST /api/medicines/interactions/check - Check drug interactions
```

### Lab Results
```
GET  /api/lab-results              - Get lab results
POST /api/lab-results              - Create lab result
GET  /api/lab-results/:id          - Get specific lab result
PUT  /api/lab-results/:id          - Update lab result
GET  /api/lab-results/available-tests - Get available tests
```

### Pharmacy
```
GET  /api/pharmacies/nearby        - Get nearby pharmacies
GET  /api/pharmacies/inventory     - Get pharmacy inventory
POST /api/pharmacies/inventory     - Add to inventory
GET  /api/pharmacies/alerts/low-stock - Get low stock alerts
```

### Files
```
POST /api/files/upload             - Upload file
GET  /api/files                    - Get user files
GET  /api/files/:id/download       - Download file
GET  /api/files/:id/thumbnail      - Get image thumbnail
```

### Notifications
```
GET  /api/notifications            - Get notifications
POST /api/notifications            - Create notification
PUT  /api/notifications/:id/read   - Mark as read
PUT  /api/notifications/read-all   - Mark all as read
```

### Chat
```
POST /api/chat/send                - Send message
GET  /api/chat/conversations       - Get conversations
GET  /api/chat/:userId/messages    - Get messages with user
GET  /api/chat/participants        - Get chat participants
```

### Payments
```
POST /api/payments/intent          - Create payment intent
POST /api/payments/confirm         - Confirm payment
GET  /api/payments                 - Get user payments
GET  /api/payments/:id             - Get specific payment
POST /api/payments/:id/refund      - Request refund
```

### Analytics
```
GET  /api/analytics/dashboard      - Dashboard analytics
GET  /api/analytics/health         - Health metrics (patients)
GET  /api/analytics/doctor         - Doctor performance
GET  /api/analytics/pharmacy       - Pharmacy analytics
GET  /api/analytics/system         - System analytics (admin)
```

### OCR
```
POST /api/ocr/process              - Process prescription image
POST /api/ocr/validate             - Validate OCR results
POST /api/ocr/enhance              - Enhance image quality
GET  /api/ocr/history              - Get OCR history
```

## Database Schema

The application uses Prisma with PostgreSQL. Key models include:

- **Users**: Multi-role user system (Patient, Doctor, Pharmacist, Admin)
- **Appointments**: Medical appointments with scheduling
- **Prescriptions**: Digital prescriptions with items
- **Medicines**: Comprehensive medicine database
- **LabResults**: Medical test results and tracking
- **Notifications**: Real-time notification system
- **ChatMessages**: In-app messaging between users
- **Payments**: Payment processing and history
- **Documents**: File storage and management

## Real-time Features

The application uses Socket.IO for real-time features:

- **Live Notifications**: Instant notifications for all users
- **Chat Messages**: Real-time messaging between healthcare providers and patients
- **Appointment Updates**: Live updates on appointment status changes
- **Prescription Updates**: Real-time prescription status notifications

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Different permissions for each user role
- **Input Validation**: Comprehensive input validation using Joi
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configurable CORS policies
- **Helmet Security**: Security headers and protection
- **Password Hashing**: Bcrypt for secure password storage

## File Processing

- **Image Upload**: Support for JPEG, PNG, GIF images
- **PDF Support**: PDF document handling
- **Image Optimization**: Automatic image resizing and compression
- **OCR Processing**: Tesseract.js for prescription text extraction
- **Thumbnail Generation**: Automatic thumbnail creation for images

## Error Handling

The API includes comprehensive error handling:

- **Global Error Handler**: Centralized error processing
- **Validation Errors**: Detailed validation error responses
- **HTTP Status Codes**: Proper status code usage
- **Error Logging**: Comprehensive error logging with Winston

## Development

### Available Scripts

```bash
npm run dev              # Start development server with nodemon
npm run start            # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:seed      # Seed database with sample data
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run test             # Run tests
```

### Project Structure

```
nurox-backend/
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── controllers/            # Request handlers
│   ├── middleware/             # Express middleware
│   ├── routes/                 # API routes
│   ├── services/               # Business logic services
│   ├── utils/                  # Utility functions
│   ├── app.js                  # Express app configuration
│   └── server.js               # Server entry point
├── .env.example               # Environment variables template
├── package.json
└── README.md
```

## Deployment

### Production Checklist

1. **Environment Variables**: Set all production environment variables
2. **Database**: Set up production PostgreSQL database
3. **SSL/TLS**: Configure HTTPS for production
4. **Process Manager**: Use PM2 or similar for process management
5. **Monitoring**: Set up logging and monitoring
6. **Backups**: Configure database backups
7. **Security**: Review and implement security best practices

### Docker Deployment (Optional)

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

## Support

For support and questions:
- Check the API documentation at `/api/docs`
- Review the error responses for debugging
- Check the logs for detailed error information

## License

This project is licensed under the MIT License.
🚗 Car Rental System Backend Documentation
📌 CONTEXT

A web-based car rental system that allows users to register, browse cars, book vehicles, and manage bookings. Admins can manage cars, users, and reservations.

Main features requiring database support:

User authentication
Car management
Booking system
Session handling
🧱 ARCHITECTURE OVERVIEW
Architecture Pattern
RESTful API (Express.js)
Authentication Strategy
JWT-based authentication
Access Token (short-lived) + Refresh Token (stored in DB)
Data Flow (Text)
Client sends request → API
API validates request
Business logic executes
Database queried/updated
Response returned
Caching Strategy
Redis caching for:
Sessions
Car listings
🗄️ DATABASE SCHEMA
👤 Table: users

Purpose: Store user accounts

Column	Type	Constraints	Description
id	UUID	PRIMARY KEY	Unique user ID
name	VARCHAR(100)	NOT NULL	User name
email	VARCHAR(150)	UNIQUE, NOT NULL	User email
password	VARCHAR(255)	NOT NULL	Hashed password
role	VARCHAR(20)	DEFAULT 'user'	user/admin
created_at	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP	Created time
updated_at	TIMESTAMP	ON UPDATE CURRENT_TIMESTAMP	Updated time
Indexes
PK: id
UNIQUE: email
🚗 Table: cars

Purpose: Store car details

Column	Type	Constraints
id	UUID	PRIMARY KEY
name	VARCHAR(100)	NOT NULL
price_per_day	DECIMAL(10,2)	NOT NULL
availability	BOOLEAN	DEFAULT TRUE
created_at	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP
updated_at	TIMESTAMP	ON UPDATE CURRENT_TIMESTAMP
📅 Table: bookings

Purpose: Store booking records

Column	Type	Constraints
id	UUID	PRIMARY KEY
user_id	UUID	FK → users(id) ON DELETE CASCADE
car_id	UUID	FK → cars(id) ON DELETE CASCADE
start_date	DATE	NOT NULL
end_date	DATE	NOT NULL
status	VARCHAR(20)	DEFAULT 'confirmed'
created_at	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP
updated_at	TIMESTAMP	ON UPDATE CURRENT_TIMESTAMP
Relationships
User → Many bookings
Car → Many bookings
🔐 Table: sessions

Purpose: Store refresh tokens

Column	Type	Constraints
id	UUID	PRIMARY KEY
user_id	UUID	FK
refresh_token	VARCHAR(255)	NOT NULL
expires_at	TIMESTAMP	NOT NULL
created_at	TIMESTAMP	DEFAULT CURRENT_TIMESTAMP
updated_at	TIMESTAMP	ON UPDATE CURRENT_TIMESTAMP
🌐 API ENDPOINTS
🔑 AUTHENTICATION
POST /api/v1/auth/register

Purpose: Register user
Auth: Public

{
  "name": "John",
  "email": "john@example.com",
  "password": "Password123"
}

Validation:

Email valid
Password ≥ 6 chars

Response:

{
  "success": true,
  "data": { "userId": "uuid" }
}

Errors:

400: Invalid input
409: Email exists
POST /api/v1/auth/login
{
  "email": "john@example.com",
  "password": "Password123"
}

Response:

{
  "accessToken": "jwt",
  "refreshToken": "token"
}
🚗 CAR APIs
GET /api/v1/cars

Auth: Public

Response:

{
  "data": []
}
POST /api/v1/cars

Auth: Admin

{
  "name": "Swift",
  "pricePerDay": 1500
}
📅 BOOKING APIs
POST /api/v1/bookings

Auth: Required

{
  "carId": "uuid",
  "startDate": "2026-05-01",
  "endDate": "2026-05-03"
}

Validation:

Dates must be future
Car available
🔐 AUTHENTICATION & AUTHORIZATION
JWT Structure
{
  "userId": "uuid",
  "role": "user",
  "exp": 1234567890
}
Authorization Levels
Public → No login
Authenticated → Valid JWT
Admin → role = admin
Password Security
bcrypt hashing
Salt rounds: 10
Min 6 chars
✅ DATA VALIDATION RULES
Email regex validation
Password ≥ 6 chars
Input sanitization
Max length limits
❌ ERROR HANDLING
Format:
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Invalid input"
}
Error Codes
400 → VALIDATION_ERROR
401 → UNAUTHORIZED
403 → FORBIDDEN
404 → NOT_FOUND
⚡ CACHING STRATEGY
Cache car list
TTL: 5 minutes
Keys:
cars:all
Invalidation:
On add/update/delete car
🚦 RATE LIMITING
Login: 5/min
API: 100/min
🔄 DATABASE MIGRATIONS
Tool: Prisma Migrate
Flow:
Dev → Test → Prod
💾 BACKUP & RECOVERY
Daily backups
Retention: 30 days
🔢 API VERSIONING
Version: v1
URL: /api/v1/
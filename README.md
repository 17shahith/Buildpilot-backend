# BuildBridge Backend Service

This is the Express + TypeScript REST API and database service for the BuildBridge Marketplace.

## Features
- **Prisma ORM** Integration with PostgreSQL.
- **REST endpoints** for Estimator suggestions, Marketplace searches, and Booking requests.
- **Redis integration** for performance caching.
- **Type-safe** development using TypeScript.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root of the `backend` folder:
   ```env
   PORT=5000
   DATABASE_URL="postgresql://username:password@localhost:5432/buildbridge?schema=public"
   REDIS_URL="redis://localhost:6379"
   ```

3. **Run Prisma Migrations**:
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

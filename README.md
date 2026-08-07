# BuildBridge Backend Service

This is the Express + TypeScript REST API and PostgreSQL service for the BuildBridge Marketplace.

## Features
- **Prisma ORM** Integration with PostgreSQL.
- **REST endpoints** for Estimator suggestions, Marketplace searches, and Booking requests.
- **Redis integration** for distributed rate limiting.
- **Type-safe** development using TypeScript.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root of the `backend` folder:
   ```env
   NODE_ENV=development
   PORT=5000
   DATABASE_URL="postgresql://username:password@localhost:5432/buildbridge?schema=public"
   REDIS_URL="redis://localhost:6379"
   JWT_SECRET="replace-with-at-least-32-random-characters"
   CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
   ```

3. **Run Prisma Migrations**:
   ```bash
   npm run prisma:migrate
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

Production requires PostgreSQL, Redis, a JWT secret of at least 32 characters, and an exact `CORS_ORIGINS` allowlist. Do not run the seed script in production.

## Branch Strategy & CI/CD Pipeline

We follow a strict branching model:
- `main` represents production. Direct pushes are blocked.
- `develop` is the integration branch.
- Feature development occurs in `feature/*` or `fix/*` branches.

### CI/CD Workflow

On every pull request to `main` or `develop`, a validation workflow runs:
1. **Secret Scanning**: Runs Gitleaks to detect exposed credentials in commits.
2. **Quality Checks**: Resolves dependencies (`npm ci`), runs TypeScript compilation, runs unit & integration tests (`npm test`), and verifies the production build.
3. **Database Validation**: Validates the Prisma schema layout.
4. **Dependency Security**: Scans for vulnerabilities via `npm audit --audit-level=high`.

Upon merging to `main` or `develop`, the **Backend CD** workflow compiles the Docker container and triggers deployment.

### Environment Management

A template `.env.example` is located in the `backend/` folder. All runtime environment configurations must be populated here. Never commit real values or secrets (like database passwords, private keys, or API tokens) to Git.


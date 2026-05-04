# GrowUp

GrowUp is a full-stack stock market simulator built with React, Redux, Express, and MongoDB. It includes JWT authentication, portfolio and watchlist management, and live market quote streaming.

## Core Features

- User registration/login with JWT access tokens and refresh sessions
- Role-aware authorization for admin and user endpoints
- Portfolio CRUD with "current user" and by-id operations
- Transaction tracking and bulk transaction reset
- Watchlist CRUD with item-level updates
- Stock quote APIs with Server-Sent Events (SSE) streams
- Admin stock catalog management
- Market index snapshot and stream endpoints

## Tech Stack

- Frontend: React 19, Redux Toolkit, React Router, Axios, Chart.js
- Backend: Node.js, Express 5, MongoDB + Mongoose, JWT, bcrypt

## Project Structure

```text
.
|-- src/                  # React application
|-- public/               # Static frontend assets
|-- server/
|   |-- src/              # Express app, routes, controllers, models
|   `-- postman/          # API collection for testing
|-- .env.example
`-- server/.env.example
```

## Prerequisites

- Node.js (v18+ recommended)
- npm
- MongoDB Community Server

## Quick Start

1. Install dependencies.

```powershell
npm install
cd .\server
npm install
cd ..
```

2. Create environment files from examples.

```powershell
Copy-Item .env.example .env
Copy-Item .\server\.env.example .\server\.env
```

3. Start the backend API.

```powershell
cd .\server
npm run dev
```

4. Start the frontend in a second terminal.

```powershell
npm start
```

5. Open the app.

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## Environment Variables

### Frontend (`/.env`)

```env
REACT_APP_API_URL=http://localhost:5000
```

### Backend (`/server/.env`)

```env
MONGODB_URI=mongodb://127.0.0.1:27017/smartbridge
JWT_SECRET=replace_with_a_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_DAYS=14
BCRYPT_SALT_ROUNDS=12
CLIENT_URL=http://localhost:3000
DEFAULT_ADMIN_EMAIL=
STOCK_QUOTE_PROVIDER=auto
FINNHUB_API_KEY=
PORT=5000
```

`STOCK_QUOTE_PROVIDER` values:

- `auto`: use Finnhub when `FINNHUB_API_KEY` exists, else fallback to Yahoo
- `finnhub`: prefer Finnhub, fallback to Yahoo
- `yahoo`: prefer Yahoo, fallback to Finnhub

## Scripts

### Frontend (root)

- `npm start` - run React dev server
- `npm run build` - create production build
- `npm test` - run test suite

### Backend (`server/`)

- `npm run dev` - run API with nodemon
- `npm start` - run API with Node.js
- `npm run migrate` - execute DB migration script

## API Overview

Base URL: `http://localhost:5000/api`

Public routes:

- `GET /health`
- `GET /market/indexes`
- `GET /market/indexes/stream`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Protected routes (Bearer token required):

- `GET /auth/me`
- `POST /auth/logout-all`
- `GET /users/me`
- `GET /stocks`
- `GET /stocks/quotes?symbols=AAPL,MSFT`
- `GET /stocks/quotes/stream?symbols=AAPL,MSFT`
- `GET|POST /portfolios`
- `GET|PATCH|DELETE /portfolios/me`
- `GET|PATCH|DELETE /portfolios/:id`
- `GET|POST|DELETE /transactions`
- `GET|PUT|DELETE /transactions/:id`
- `GET|POST /watchlists`
- `GET|PUT|DELETE /watchlists/me`
- `POST /watchlists/me/items`
- `PATCH|DELETE /watchlists/me/items/:stockId`
- `GET|PUT|DELETE /watchlists/:id`
- `GET|POST /admin/stocks` (admin only)
- `GET|PUT|DELETE /admin/stocks/:id` (admin only)

## Postman

Import:

- `server/postman/SmartBridge.postman_collection.json`

Suggested test flow:

1. Run `Register`
2. Run `Login`
3. Copy `token` from the response body
4. Set collection variable `token`
5. Execute protected routes

## Release Process

See `RELEASE_CHECKLIST.md` for a complete pre-release and publishing checklist.

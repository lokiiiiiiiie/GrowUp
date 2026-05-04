# GrowUp Release Checklist

Use this checklist before publishing a new version.

## 1. Prepare Branch

- [ ] Pull the latest code: `git pull origin main`
- [ ] Confirm clean working tree: `git status`
- [ ] Verify release changes are complete (README, env examples, docs)

## 2. Security and Config

- [ ] Confirm secrets are not tracked: `git ls-files .env server/.env`
- [ ] Verify `.env` and `server/.env` are set for local testing
- [ ] Validate critical backend vars: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `PORT`
- [ ] Ensure frontend API URL is correct: `REACT_APP_API_URL`

## 3. Backend Validation

- [ ] Install backend dependencies: `cd server && npm install`
- [ ] Run migrations: `npm run migrate`
- [ ] Start backend: `npm run dev`
- [ ] Check health endpoint: `GET http://localhost:5000/api/health`
- [ ] Smoke test auth, stocks, portfolios, transactions, and watchlists

## 4. Frontend Validation

- [ ] Install frontend dependencies: `npm install`
- [ ] Start frontend: `npm start`
- [ ] Verify login, dashboard, trade, portfolio, and watchlist flows
- [ ] Build production bundle successfully: `npm run build`

## 5. Publish

- [ ] Commit release updates: `git add . && git commit -m "release: vX.Y.Z"`
- [ ] Push to GitHub: `git push origin main`
- [ ] Create release tag: `git tag -a vX.Y.Z -m "GrowUp vX.Y.Z"`
- [ ] Push tag: `git push origin vX.Y.Z`
- [ ] Create GitHub release notes from the tag

## 6. Post-Release Verification

- [ ] Recheck deployed health endpoint
- [ ] Verify authentication and token refresh in production
- [ ] Verify quotes/stream endpoints and core user actions
- [ ] Monitor logs and errors for the first 24 hours

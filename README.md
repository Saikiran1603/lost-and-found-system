# Lost & Found Item Recovery System

React + TypeScript + Vite + Tailwind CSS + React Router + Axios, with JSON Server as the mock backend.

## Run locally
```bash
npm install
npm start          # JSON Server on :3001 and Vite on :5173
```
Or separately: `npm run server` and `npm run dev`.

## Demo logins
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lostfound.com | admin123 |
| Staff / Verifier | staff@lostfound.com | staff123 |
| User | priya@example.com | user123 |
| User | ravi@example.com | user123 |

## Workflow
1. User reports a lost item, or anyone registers a found item. Matches are scored from category, keywords, location and a 14-day date window, and stored in `matchSuggestions`.
2. The lost-report owner, staff or admin confirms or rejects each match.
3. A user submits a claim (identifying details + proof notes). One active claim per user per item.
4. Staff move the claim: Submitted → Under Review → More Information Required / Approved / Rejected. Every step writes a `verifications` record, an `activityLogs` entry and a notification.
5. Approval creates a handover: Ready for Handover → Handed Over (date + verifier) → Closed.

## Deployment

JSON Server is a long-running Node server that writes to `db.json`, so it **cannot run on Netlify or Vercel** (static hosting and serverless functions have no persistent server or disk). Deploy in two parts:

### 1. Backend: JSON Server on Render (free)
1. Push this project to GitHub.
2. Render > New > Web Service > pick the repo.
3. Build command: `npm install` · Start command: `npm run server:prod`
4. Copy the service URL, e.g. `https://lost-found-api.onrender.com`.

Free Render services sleep after inactivity (first request takes ~30s) and reset `db.json` on redeploy. Fine for a demo.

### 2. Frontend: Netlify
1. Netlify > Add new site > Import from GitHub.
2. Build command `npm run build`, publish directory `dist` (already set in `netlify.toml`).
3. Site settings > Environment variables: `VITE_API_URL` = your Render URL (https, no trailing slash).
4. Trigger a deploy. The variable is read at build time, so redeploy after changing it.

# CivicReport - Backend Starter (Express)

This backend is a minimal Express server that provides simple in-memory storage for reports and supports file uploads (images).
It is intended for local development/testing with the frontend scaffold provided earlier.

## Run locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   node server.js
   ```
   or (recommended during development):
   ```bash
   npx nodemon server.js
   ```

The server will run on http://localhost:4000 by default and exposes the following endpoints:

- `POST /api/reports` - create a new report (multipart/form-data). Fields: photo (file), type, description, lat, lng
- `GET /api/reports` - list reports
- `GET /api/reports/:id` - get one report
- `PATCH /api/reports/:id` - update a report (status, description, etc.)
- `GET /uploads/:filename` - serve uploaded images

Notes:
- This uses in-memory storage (an array). Data will reset when the server restarts.
- For production, replace in-memory storage with a real database (Postgres/Supabase) and use S3/Supabase Storage for files.

// server.js
// Express backend for CivicReport with optional MongoDB persistence (Atlas or local).
const express = require('express')
const multer = require('multer')
const path = require('path')
const cors = require('cors')
const fs = require('fs')
const crypto = require('crypto')
require('dotenv').config()

const { MongoClient, ServerApiVersion } = require('mongodb')

const app = express()
const PORT = Number(process.env.PORT || 4000)

// CORS - permissive by default for local dev
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const BASE_DIR = __dirname
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads')
const DATA_FILE = path.join(BASE_DIR, 'reports.json')

// ensure uploads folder exists
try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })
} catch (err) {
  console.error('Failed to create uploads dir', err)
  process.exit(1)
}

/* ---------------------
   Persistence strategy
   - If MONGO_URI is set and DB connection succeeds -> use MongoDB collection
   - Otherwise -> fallback to file-based (reports.json) + in-memory array
   --------------------- */
const MONGO_URI = process.env.MONGO_URI || ''
const MONGO_DB = process.env.MONGO_DB || 'civicsense'
const MONGO_COLLECTION = process.env.MONGO_COLLECTION || 'reports'

let mongoClient = null
let db = null
let reportsCol = null
let usingMongo = false

// in-memory fallback
let reports = []
let idCounter = 1

// load from file (fallback)
function loadReportsFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8')
      reports = JSON.parse(raw) || []
      const maxId = reports.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0)
      idCounter = maxId + 1
    } else {
      reports = []
      idCounter = 1
    }
  } catch (err) {
    console.warn('Failed to load persisted reports, starting fresh', err)
    reports = []
    idCounter = 1
  }
}

function persistReportsToFileDebounced() {
  if (persistReportsToFileDebounced._t) clearTimeout(persistReportsToFileDebounced._t)
  persistReportsToFileDebounced._t = setTimeout(() => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2), 'utf8')
    } catch (err) {
      console.error('Failed to persist reports', err)
    }
  }, 200)
}

// helper: safe parse float -> null if invalid
function safeFloat(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/* ---------------------
   Multer (file uploads)
   --------------------- */
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const name = crypto.randomBytes(12).toString('hex')
    cb(null, `${Date.now()}-${name}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Invalid file type. Only images are allowed.'))
    }
    cb(null, true)
  },
})

// serve uploaded files
app.use('/uploads', express.static(UPLOADS_DIR, { index: false }))

/* ---------------------
   Admin auth (same as before)
   --------------------- */
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'admin123').toString()
const validTokens = new Set()
function generateToken() {
  return crypto.randomBytes(24).toString('hex')
}
function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || ''
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid authorization header' })
    }
    const token = auth.slice(7).trim()
    if (!token || !validTokens.has(token)) {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid token' })
    }
    req.adminToken = token
    next()
  } catch (err) {
    next(err)
  }
}

app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body || {}
    if (!password) return res.status(400).json({ error: 'missing_password', message: 'Password required' })
    if (String(password) === ADMIN_PASSWORD) {
      const token = generateToken()
      validTokens.add(token)
      return res.json({ ok: true, token })
    }
    return res.status(401).json({ error: 'invalid_credentials', message: 'Invalid password' })
  } catch (err) {
    console.error('Error in /api/admin/login', err)
    return res.status(500).json({ error: 'internal', message: 'Login failed' })
  }
})
app.post('/api/admin/logout', requireAuth, (req, res) => {
  try {
    const token = req.adminToken
    if (token && validTokens.has(token)) validTokens.delete(token)
    return res.json({ ok: true })
  } catch (err) {
    console.error('Error in /api/admin/logout', err)
    return res.status(500).json({ error: 'internal', message: 'Logout failed' })
  }
})

/* ---------------------
   Persistence helpers (work either with Mongo or fallback)
   --------------------- */

async function insertReport(report) {
  // returns the saved report object (with id)
  if (usingMongo && reportsCol) {
    // ensure created/updated timestamps
    const now = new Date().toISOString()
    const r = {
      ...report,
      created_at: report.created_at || now,
      updated_at: report.updated_at || now,
    }
    const res = await reportsCol.insertOne(r)
    // res.insertedId is an ObjectId; set id string field for convenience
    r.id = String(res.insertedId)
    try {
      await reportsCol.updateOne({ _id: res.insertedId }, { $set: { id: r.id } })
    } catch (e) {
      // non-fatal if update fails
      console.warn('Warning: failed to set id field on inserted report', e && e.message)
    }
    // return a cleaned object to client
    return {
      ...r,
      _id: res.insertedId,
    }
  } else {
    const id = String(idCounter++)
    const now = new Date().toISOString()
    const r = {
      id,
      type: String(report.type || 'other'),
      description: String(report.description || ''),
      photo_url: report.photo_url || null,
      location_lat: safeFloat(report.location_lat ?? report.lat ?? report.latitude ?? null),
      location_lng: safeFloat(report.location_lng ?? report.lng ?? report.longitude ?? null),
      status: report.status || 'submitted',
      contact: report.contact || null,
      name: report.name || null,
      address: report.address || null,
      email: report.email || null,
      assigned_department_id: null,
      quarantined: false,
      created_by: report.created_by || null,
      created_at: report.created_at || now,
      updated_at: report.updated_at || now,
    }
    reports.unshift(r)
    persistReportsToFileDebounced()
    return r
  }
}

async function findReportsPublic({ status, type, q, page = 1, limit = 10 } = {}) {
  if (usingMongo && reportsCol) {
    const filter = { quarantined: { $ne: true } }
    if (status) filter.status = status
    if (type) filter.type = type
    if (q) {
      const qq = String(q)
      filter.$or = [
        { description: { $regex: qq, $options: 'i' } },
        { type: { $regex: qq, $options: 'i' } },
        { address: { $regex: qq, $options: 'i' } },
        { name: { $regex: qq, $options: 'i' } },
      ]
    }
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * Math.max(1, parseInt(limit, 10) || 10)
    const cursor = reportsCol.find(filter).sort({ created_at: -1 }).skip(skip).limit(Math.max(1, parseInt(limit, 10) || 10))
    const docs = await cursor.toArray()
    // map to API shape
    return docs.map((r) => ({
      id: r.id ?? String(r._id ?? ''),
      type: r.type,
      summary: (r.description || '').slice(0, 300),
      photo_url: r.photo_url,
      location_lat: r.location_lat,
      location_lng: r.location_lng,
      address: r.address ?? r.location_text ?? null,
      location_text: r.location_text ?? r.address ?? null,
      name: r.name ?? null,
      status: r.status,
      created_at: r.created_at,
    }))
  } else {
    let out = reports.filter((r) => !r.quarantined)
    if (status) out = out.filter((r) => String(r.status) === String(status))
    if (type) out = out.filter((r) => String(r.type) === String(type))
    if (q) {
      const qq = String(q).toLowerCase()
      out = out.filter((r) => {
        const hay = `${r.description || ''} ${r.type || ''} ${r.address || ''} ${r.name || ''}`.toLowerCase()
        return hay.includes(qq)
      })
    }
    // paging
    const p = Math.max(1, Number(page || 1))
    const l = Math.max(1, Math.min(100, Number(limit || 10)))
    const start = (p - 1) * l
    const paged = out.slice(start, start + l)
    return paged.map((r) => ({
      id: r.id,
      type: r.type,
      summary: (r.description || '').slice(0, 300),
      photo_url: r.photo_url,
      location_lat: r.location_lat,
      location_lng: r.location_lng,
      address: r.address ?? r.location ?? r.location_text ?? null,
      location_text: r.location_text ?? r.address ?? r.location ?? null,
      name: r.name ?? null,
      status: r.status,
      created_at: r.created_at,
    }))
  }
}

// load single report
async function getReportById(id) {
  if (usingMongo && reportsCol) {
    try {
      const { ObjectId } = require('mongodb')
      const q = [{ id: String(id) }]
      if (ObjectId.isValid(id)) q.push({ _id: new ObjectId(id) })
      const doc = await reportsCol.findOne({ $or: q })
      return doc || null
    } catch (e) {
      console.warn('getReportById error', e && e.message)
      return null
    }
  } else {
    return reports.find((r) => String(r.id) === String(id))
  }
}

async function updateReportById(id, patch = {}) {
  if (usingMongo && reportsCol) {
    const { ObjectId } = require('mongodb')
    const q = { $or: [{ id: String(id) }] }
    if (ObjectId.isValid(id)) q.$or.push({ _id: new ObjectId(id) })
    const update = { $set: { ...patch, updated_at: new Date().toISOString() } }
    const res = await reportsCol.findOneAndUpdate(q, update, { returnDocument: 'after' })
    return res.value
  } else {
    const idx = reports.findIndex((r) => String(r.id) === String(id))
    if (idx === -1) return null
    const r = reports[idx]
    const updated = { ...r, ...patch, updated_at: new Date().toISOString() }
    reports[idx] = updated
    persistReportsToFileDebounced()
    return updated
  }
}

async function deleteReportById(id) {
  if (usingMongo && reportsCol) {
    const { ObjectId } = require('mongodb')
    const q = { $or: [{ id: String(id) }] }
    if (ObjectId.isValid(id)) q.$or.push({ _id: new ObjectId(id) })
    const res = await reportsCol.findOneAndDelete(q)
    return res.value
  } else {
    const idx = reports.findIndex((r) => String(r.id) === String(id))
    if (idx === -1) return null
    const [removed] = reports.splice(idx, 1)
    persistReportsToFileDebounced()
    return removed
  }
}

/* ---------------------
   Public endpoints
   --------------------- */

// list public paged reports
app.get('/api/public/reports', async (req, res, next) => {
  try {
    const { status, type, q, page = 1, limit = 10 } = req.query
    const results = await findReportsPublic({ status, type, q, page, limit })
    res.json({ ok: true, page: Number(page), limit: Number(limit), total: results.length, data: results })
  } catch (e) {
    next(e)
  }
})

// create a report (public)
app.post('/api/reports', (req, res, next) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      console.error('Multer error', err)
      return res.status(400).json({ error: 'upload_error', message: err.message })
    }
    try {
      const body = req.body || {}

      const type = body.type || body.category || 'other'
      const description = body.description || body.desc || body.details || ''
      const lat = body.lat || body.latitude || body.location_lat
      const lng = body.lng || body.longitude || body.location_lng

      const contact =
        body.contact ||
        body.phone ||
        body.mobile ||
        body.phone_number ||
        body.phoneNumber ||
        body.phone_no ||
        null

      const name =
        body.name ||
        body.fullName ||
        body.fullname ||
        body.reporter ||
        body.created_by ||
        null

      // prefer explicit address/location_text/location
      const address = body.address || body.location || body.location_text || null
      const email = body.email || body.email_address || body.emailAddress || null
      const created_by = body.created_by || body.createdBy || null

      const photo = req.file ? `/uploads/${path.basename(req.file.filename)}` : null

      const reportPayload = {
        type,
        description,
        photo_url: photo,
        location_lat: safeFloat(lat),
        location_lng: safeFloat(lng),
        contact,
        name,
        address,
        email,
        created_by,
        status: 'submitted',
      }

      const saved = await insertReport(reportPayload)
      // return created resource
      res.status(201).json(saved)
    } catch (e) {
      next(e)
    }
  })
})

/* Admin endpoints (requireAuth) */

// admin listing (returns raw reports array or DB docs)
app.get('/api/reports', requireAuth, async (req, res, next) => {
  try {
    const { status, type, mine, user, quarantined, q } = req.query
    if (usingMongo && reportsCol) {
      const filter = {}
      if (quarantined !== undefined) {
        const want = quarantined === 'true' || quarantined === true
        filter.quarantined = want
      }
      if (status) filter.status = status
      if (type) filter.type = type
      if (q) {
        const qq = String(q)
        filter.$or = [
          { description: { $regex: qq, $options: 'i' } },
          { type: { $regex: qq, $options: 'i' } },
          { address: { $regex: qq, $options: 'i' } },
          { name: { $regex: qq, $options: 'i' } },
        ]
      }
      if (mine === 'true') {
        // if the client requests only reports created by the current user, they must pass user param
        if (user) filter.created_by = String(user)
        else filter._id = { $exists: false } // force empty
      }
      const docs = await reportsCol.find(filter).sort({ created_at: -1 }).toArray()
      return res.json(docs)
    } else {
      let out = [...reports]
      if (quarantined !== undefined) {
        const want = quarantined === 'true' || quarantined === true
        out = out.filter((r) => Boolean(r.quarantined) === want)
      }
      if (mine === 'true') {
        if (req.query.user) out = out.filter((r) => r.created_by && String(r.created_by) === String(req.query.user))
        else out = []
      }
      if (status) out = out.filter((r) => String(r.status) === String(status))
      if (type) out = out.filter((r) => String(r.type) === String(type))
      if (q) {
        const qq = String(q).toLowerCase()
        out = out.filter((r) => {
          const hay = `${r.description || ''} ${r.type || ''} ${r.address || ''} ${r.name || ''}`.toLowerCase()
          return hay.includes(qq)
        })
      }
      return res.json(out)
    }
  } catch (e) {
    next(e)
  }
})

// get single
app.get('/api/reports/:id', async (req, res, next) => {
  try {
    const report = await getReportById(req.params.id)
    if (!report) return res.status(404).json({ error: 'not_found' })
    res.json(report)
  } catch (e) {
    next(e)
  }
})

// patch
app.patch('/api/reports/:id', requireAuth, async (req, res, next) => {
  try {
    const patch = {}
    const { status, description, type, assigned_department_id, quarantined, quarantine_reason } = req.body
    if (status !== undefined) patch.status = status
    if (description !== undefined) patch.description = description
    if (type !== undefined) patch.type = type
    if (assigned_department_id !== undefined) patch.assigned_department_id = assigned_department_id
    if (quarantined !== undefined) patch.quarantined = quarantined === true || quarantined === 'true'
    if (quarantine_reason !== undefined) patch.quarantine_reason = quarantine_reason
    const updated = await updateReportById(req.params.id, patch)
    if (!updated) return res.status(404).json({ error: 'not_found' })
    res.json(updated)
  } catch (e) {
    next(e)
  }
})

// delete
app.delete('/api/reports/:id', requireAuth, async (req, res, next) => {
  try {
    const removed = await deleteReportById(req.params.id)
    if (!removed) return res.status(404).json({ error: 'not_found' })
    // remove uploaded file if present
    try {
      if (removed.photo_url) {
        const filename = path.basename(removed.photo_url)
        const filePath = path.join(UPLOADS_DIR, filename)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }
    } catch (e) {
      console.warn('Failed to delete uploaded file', e)
    }
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

app.get('/api/health', (req, res) => res.json({ ok: true, now: new Date().toISOString(), usingMongo }))

/* Global error handler */
app.use((err, req, res, next) => {
  console.error('Unhandled error', err)
  const payload = { error: 'internal_server_error', message: err.message || 'Server error' }
  if (process.env.NODE_ENV === 'development' && err.stack) payload.stack = err.stack
  res.status(500).json(payload)
})

/* ---------------------
   Startup & DB connection
   --------------------- */
async function start() {
  // if no MONGO_URI, load file fallback now
  if (!MONGO_URI) {
    console.warn('Warning: MONGO_URI not set. Server will run using file-based persistence (reports.json).')
    loadReportsFromFile()
  } else {
    try {
      // connect to MongoDB
      mongoClient = new MongoClient(MONGO_URI, {
        serverApi: ServerApiVersion.v1,
        // the new driver ignores useNewUrlParser/useUnifiedTopology - avoid passing them
        // use a reasonable connect timeout
        connectTimeoutMS: 10000,
      })
      await mongoClient.connect()
      db = mongoClient.db(MONGO_DB)
      reportsCol = db.collection(MONGO_COLLECTION)
      usingMongo = true
      console.log('Connected to MongoDB at', MONGO_URI ? '[MONGO_URI provided]' : '[no MONGO_URI]')
      // Optionally ensure some indexes (for search / performance)
      try {
        // create text index on description, address, type, name to support quick searches (safe if already exists)
        await reportsCol.createIndex(
          { description: 'text', address: 'text', type: 'text', name: 'text' },
          { name: 'search_text_idx', background: true }
        )
      } catch (e) {
        // non-fatal
        console.warn('Could not create indexes on reports collection', e.message || e)
      }
    } catch (err) {
      console.error('Failed to connect to MongoDB, falling back to file persistence:', err.message || err)
      usingMongo = false
      loadReportsFromFile()
    }
  }

  // start listening
  app.listen(PORT, () => {
    console.log(`CivicReport backend running at http://localhost:${PORT}`)
    console.log(`Using MongoDB: ${Boolean(usingMongo)}`)
  })
}

/* Graceful shutdown */
async function gracefulExit() {
  try {
    if (mongoClient) {
      try {
        await mongoClient.close()
        console.log('Closed MongoDB connection')
      } catch (e) {
        console.warn('Error closing MongoDB connection', e)
      }
    }
    // ensure file persisted if fallback
    if (!usingMongo) {
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2), 'utf8')
        console.log('Saved reports to', DATA_FILE)
      } catch (e) {
        console.error('Error saving reports on exit', e)
      }
    }
  } catch (e) {
    // ignore
  }
  process.exit()
}

process.on('SIGINT', gracefulExit)
process.on('SIGTERM', gracefulExit)
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION', err)
  gracefulExit()
})
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION', reason)
})

// start server
start().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})

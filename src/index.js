import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import globalRoutes from "./routes/globalRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import connectDB from "./utils/databases.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import courseRoutes from "./routes/coursesRoutes.js"
import studentRoutes from "./routes/studentRoutes.js"
import overviewRoutes from "./routes/overviewRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js"

dotenv.config()

const app = express()

const port = process.env.PORT || 3000

// CORS — batasi akses hanya dari frontend
const allowedOrigins = [
  'http://localhost:5173',
  'https://lms-mern-fe.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}))

// Security headers
app.use(helmet())

// Percaya 1 lapis proxy (Vercel) supaya IP client terbaca benar oleh rate limiter
app.set('trust proxy', 1)

// Parsing body JSON dan urlencoded
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('public'))

// Rate limit khusus endpoint auth → mencegah brute force password/email
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: 30, // maksimal 30 percobaan per IP per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan, silakan coba lagi nanti.' },
})

app.use('/api/sign-in', authLimiter)
app.use('/api/sign-up', authLimiter)

// ✅ Middleware: pastikan DB terhubung di setiap request (penting untuk Serverless)
app.use(async (req, res, next) => {
  try {
    await connectDB()
    next()
  } catch (error) {
    // DB tidak tersedia → balas 503 (sebelumnya error ditelan lalu berujung 500)
    return res.status(503).json({
      message: 'Database sedang tidak tersedia, silakan coba beberapa saat lagi.',
    })
  }
})

app.get('/', (req, res) => {
  res.json({ text: 'LMS API is running 🚀' })
})

app.use('/api', globalRoutes)
app.use('/api', authRoutes)
app.use('/api', paymentRoutes)
app.use('/api', courseRoutes)
app.use('/api', studentRoutes)
app.use('/api', overviewRoutes)
app.use('/api', categoryRoutes)

// Global error handler — WAJIB paling akhir.
// Menangkap error yang tidak tertangani controller (termasuk error upload/multer).
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err?.message)

  if (err?.name === 'MulterError') {
    return res.status(400).json({
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran file terlalu besar (maksimal 5MB).'
          : err.message,
    })
  }

  if (typeof err?.message === 'string' && err.message.includes('Only image files')) {
    return res.status(400).json({ message: err.message })
  }

  return res.status(500).json({
    message: 'Internal Server Error',
    // Detail hanya dibuka di luar production agar tidak membocorkan struktur internal
    error: process.env.NODE_ENV === 'production' ? undefined : err?.message,
  })
})

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
}

export default app

import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
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
connectDB()

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

// Parsing body JSON dan urlencoded
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('public'))

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

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
}

export default app

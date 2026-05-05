import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import globalRoutes from "./routes/globalRoutes.js"
import authRoutes from "./routes/authRoutes.js"
import connectDB from "./utils/databases.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import courseRoutes from "./routes/coursesRoutes.js"
import studentRoutes from "./routes/studentRoutes.js"
import overviewRoutes from "./models/overviewRoutes.js"
import categoryRoutes from "./routes/categoryRoutes.js"

const app = express()
dotenv.config()
connectDB()

const port = 3000

app.use(cors())

// Parsing body JSON dan urlencoded
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static('public'))

app.get('/', (req, res) => {
  res.json({ text: 'Hello World' })
})

app.use('/api', globalRoutes)
app.use('/api', authRoutes)
app.use('/api', paymentRoutes)
app.use('/api', courseRoutes)
app.use('/api', studentRoutes)
app.use('/api', overviewRoutes)
app.use('/api', categoryRoutes)




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

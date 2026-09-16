import mongoose from "mongoose";

// Cache koneksi untuk Serverless (Vercel)
// Tanpa ini, setiap request akan membuka koneksi baru
let cached = global._mongooseCache;
if (!cached) {
    cached = global._mongooseCache = { conn: null, promise: null, failedAt: null };
}

// Jeda minimal sebelum mencoba connect lagi setelah gagal (mencegah thundering herd)
const RECONNECT_COOLDOWN_MS = 5000;

export default async function connectDB() {
    const DATABASES_URL = process.env.DATABASES_URL ?? "";

    if (!DATABASES_URL) {
        throw new Error("DATABASES_URL belum dikonfigurasi");
    }

    // Jika sudah ada koneksi yang benar-benar aktif, pakai yang sudah ada
    if (cached.conn && mongoose.connection.readyState === 1) {
        return cached.conn;
    }

    // Kalau percobaan terakhir gagal dalam beberapa detik terakhir, jangan coba lagi dulu
    if (
        !cached.promise &&
        cached.failedAt &&
        Date.now() - cached.failedAt < RECONNECT_COOLDOWN_MS
    ) {
        throw new Error("Database belum tersedia (cooldown reconnect)");
    }

    // Jika belum ada, buat koneksi baru dan cache
    if (!cached.promise) {
        cached.promise = mongoose
            .connect(DATABASES_URL, { serverSelectionTimeoutMS: 10000 })
            .then((mongooseInstance) => {
                // Jangan log URL lengkap — berisi username & password
                console.log(`Databases Connected: ${DATABASES_URL.split("@").pop()}`);
                cached.failedAt = null;
                return mongooseInstance;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        // Reset cache + catat waktu gagal, lalu LEMPAR error-nya supaya pemanggil
        // bisa membalas 503 (sebelumnya error ditelan → berujung 500 tanpa penjelasan).
        cached.promise = null;
        cached.conn = null;
        cached.failedAt = Date.now();
        console.error(`Connection Error: ${error.message}`);
        throw error;
    }

    return cached.conn;
}

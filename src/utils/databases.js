import mongoose from "mongoose";

// Cache koneksi untuk Serverless (Vercel)
// Tanpa ini, setiap request akan membuka koneksi baru
let cached = global._mongooseCache;
if (!cached) {
    cached = global._mongooseCache = { conn: null, promise: null };
}

export default async function connectDB() {
    const DATABASES_URL = process.env.DATABASES_URL ?? "";

    // Jika sudah ada koneksi yang aktif, pakai yang sudah ada
    if (cached.conn) {
        return cached.conn;
    }

    // Jika belum ada, buat koneksi baru dan cache
    if (!cached.promise) {
        cached.promise = mongoose.connect(DATABASES_URL).then((mongoose) => {
            console.log(`Databases Connected: ${DATABASES_URL}`);
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        console.error(`Connection Error: ${error}`);
    }

    return cached.conn;
}

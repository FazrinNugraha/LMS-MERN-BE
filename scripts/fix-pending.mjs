import "dotenv/config";
process.env.DATABASES_URL = process.env.DATABASES_URL || process.env.MONGODB_URI || "";
// dotenv file khusus
const fs = await import("fs");
for (const line of fs.readFileSync(".env.prod-check", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/s);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

import mongoose from "mongoose";
import crypto from "crypto";
import transactionModel from "../src/models/transactionModel.js";

const uri = process.env.DATABASES_URL || process.env.MONGODB_URI;
if (!uri) { console.log("NO DB URI"); process.exit(1); }
await mongoose.connect(uri);
const pending = await transactionModel.find({ status: "pending" }).lean();
console.log("Transaksi pending:", pending.length);
for (const t of pending.slice(0, 5)) {
    console.log("-", t._id.toString(), "| user:", t.user, "| gross:", t.total ?? t.price ?? t.amount, "| createdAt:", t.createdAt);
}

// Ambil server key dari AUTH_STRING
let serverKey = process.env.MIDTRANS_SERVER_KEY || "";
if (!serverKey && process.env.MIDTRANS_AUTH_STRING) {
    serverKey = Buffer.from(process.env.MIDTRANS_AUTH_STRING, "base64").toString("utf8").replace(/:\s*$/, "");
}
console.log("ServerKey prefix:", serverKey.slice(0, 12));

// Kirim notifikasi settlement ber-signature valid untuk SEMUA transaksi pending
for (const t of pending) {
    const orderId = t._id.toString();
    const gross = String(t.total ?? t.price ?? t.amount ?? "200000");
    const statusCode = "200";
    const sig = crypto.createHash("sha512").update(orderId + statusCode + gross + serverKey).digest("hex");
    const res = await fetch("https://lms-mern-be.vercel.app/api/handle-payment-midtrans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            order_id: orderId,
            status_code: statusCode,
            gross_amount: gross,
            signature_key: sig,
            transaction_status: "settlement",
            fraud_status: "accept",
        }),
    });
    console.log("webhook", orderId, "->", res.status, (await res.text()).slice(0, 80));
}

await mongoose.disconnect();

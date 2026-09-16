import crypto from "crypto";
import mongoose from "mongoose";
import transactionModel from "../models/transactionModel.js";

/**
 * Ambil Midtrans Server Key dari environment.
 * Mendukung 2 format supaya tetap kompatibel dengan konfigurasi yang sudah ada:
 * - MIDTRANS_SERVER_KEY   → nilai server key langsung
 * - MIDTRANS_AUTH_STRING  → base64 dari "<serverKey>:" (dipakai untuk header Authorization Basic)
 */
const getServerKey = () => {
    if (process.env.MIDTRANS_SERVER_KEY) {
        return process.env.MIDTRANS_SERVER_KEY;
    }

    const authString = process.env.MIDTRANS_AUTH_STRING ?? "";

    if (!authString) {
        return "";
    }

    return Buffer.from(authString, "base64").toString("utf8").replace(/:\s*$/, "");
};

/**
 * Verifikasi signature_key notifikasi Midtrans.
 * Formula resmi: SHA512(order_id + status_code + gross_amount + ServerKey)
 * Tanpa verifikasi ini, siapa pun bisa mengirim notifikasi palsu dan mengaktifkan akun tanpa bayar.
 */
const isValidSignature = (body) => {
    const serverKey = getServerKey();

    if (!serverKey) {
        return false;
    }

    const payload = `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`;
    const expected = crypto.createHash("sha512").update(payload).digest("hex");
    const received = String(body.signature_key ?? "");

    if (received.length !== expected.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
};

export const handlePayment = async (req, res) => {
    try {

        const body = req.body

        const orderId = body.order_id

        // 🔒 Verifikasi bahwa notifikasi ini benar-benar berasal dari Midtrans
        if (!getServerKey()) {
            console.error("MIDTRANS_SERVER_KEY / MIDTRANS_AUTH_STRING belum dikonfigurasi di environment")
            return res.status(500).json({ message: "Payment verification is not configured" })
        }

        if (!isValidSignature(body)) {
            return res.status(401).json({ success: false, message: "Invalid signature" })
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: "Invalid order id" })
        }

        const transaction = await transactionModel.findById(orderId)

        if (!transaction) {
            return res.status(404).json({ message: "Transaction not found" })
        }

        // Idempotent: Midtrans bisa mengirim notifikasi yang sama lebih dari sekali
        if (transaction.status === "succses") {
            return res.json({ message: "Handle Payment Succses", data: {} })
        }
        
        switch (body.transaction_status) {
            case "capture":
            case "settlement":
                await transactionModel.findByIdAndUpdate(orderId,{
                    status : "succses"
                })
                
                break;

                case "deny":
                case "cancel":
                case "expired":
                case "failure":

                  await transactionModel.findByIdAndUpdate(orderId,{
                    status : "failed"
                })
                
        
            default:
                break;
        }

        return res.json({
            message: "Handle Payment Succses",
            data: {}
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            message: "Internal Server Error"
        })

    }

}

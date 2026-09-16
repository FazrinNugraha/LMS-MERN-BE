import jwt from "jsonwebtoken"
import userModel from "../models/userModel.js"

// ===== Konfigurasi JWT (opt-in hardening) =====
// Diaktifkan kalau env-nya diset. Default (tidak diset) = perilaku lama
// supaya token yang sudah beredar tidak langsung mati.
const JWT_ISSUER = process.env.JWT_ISSUER || null
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || null
const JWT_ALGORITHMS = (process.env.JWT_ALGORITHMS || "HS256")
    .split(",")
    .map((alg) => alg.trim())
    .filter(Boolean)

export const verifyToken = async (req, res, next) => {
    const secretKey = process.env.SECRET_KEY_JWT ?? ""

    if (req?.headers?.authorization?.split(" ")[0] === "JWT") {
        try {
            // Pin algoritma (alg confusion) selalu aktif; issuer/audience dicek kalau di-set.
            const verifyOptions = { algorithms: JWT_ALGORITHMS }
            if (JWT_ISSUER) verifyOptions.issuer = JWT_ISSUER
            if (JWT_AUDIENCE) verifyOptions.audience = JWT_AUDIENCE

            const decoded = jwt.verify(
                req?.headers?.authorization?.split(" ")[1],
                secretKey,
                verifyOptions
            )

            const user = await userModel.findById(
                decoded.data.id,
                "_id name email role photo passwordChangedAt"
            )

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized access",
                })
            }

            // 🔒 Token yang diterbitkan SEBELUM password diganti otomatis tidak berlaku.
            // Menutup celah: password sudah diganti, tapi token lama (7 hari) masih bisa dipakai.
            if (
                user.passwordChangedAt &&
                decoded.iat * 1000 < new Date(user.passwordChangedAt).getTime()
            ) {
                return res.status(401).json({
                    success: false,
                    message: "Session expired after password change, please login again",
                })
            }
            req.user = {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                photo: user.photo,
            }
            next()
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Token expired, please login again",
                })
            }
            return res.status(401).json({
                success: false,
                message: "Invalid token",
            })
        }
    } else {
        return res.status(401).json({
            message: "Unauthorized access - Token missing",
        })
    }
}
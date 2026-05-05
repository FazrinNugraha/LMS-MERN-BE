import jwt from "jsonwebtoken"
import userModel from "../models/userModel.js"

export const verifyToken = async (req, res, next) => {
    const secretKey = process.env.SECRET_KEY_JWT ?? ""

    if (req?.headers?.authorization?.split(" ")[0] === "JWT") {
        try {
            const decoded = jwt.verify(
                req?.headers?.authorization?.split(" ")[1],
                secretKey
            )

            const user = await userModel.findById(
                decoded.data.id,
                "_id name email role photo"
            )

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized access",
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
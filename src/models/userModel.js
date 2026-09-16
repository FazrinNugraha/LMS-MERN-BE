import mongoose from "mongoose";

const userModel = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    photo: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    // Menandai kapan password terakhir diganti → dipakai verifyToken untuk
    // membuat semua token lama otomatis tidak berlaku.
    passwordChangedAt: {
        type: Date
    },
    role: {
        type: String,
        enum: ['manager', 'student'],
        default: 'manager'
    },
    courses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }],
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
})

export default mongoose.model("User" , userModel)
import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import courseModel from "../models/courseModel.js";
import { caseInsensitiveExact } from "../utils/regex.js";
import bcrypt from "bcryptjs";
import { mutateStudentSchema } from "../utils/schema.js";
import { uploadStudentPhoto, deleteFromCloudinary } from "../config/cloudinary.js";

export const getStudent = async (req, res) => {
  try {
    const student = await userModel
      .find({
        role: "student",
        manager: req.user._id,
      })
      .select("name courses photo");

    // ✅ Cloudinary sudah return full URL
    const response = student.map((item) => {
      return {
        ...item.toObject(),
        photo_url: item.photo, // Sudah full URL dari Cloudinary
      };
    });

    return res.status(200).json({
      message: "Get students successfully",
      data: response,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    // Guard penting: id yang tidak valid JANGAN sampai dipakai di query Mongo,
    // karena filter dengan _id tidak valid bisa "nyasar" ke dokumen lain.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Student not found" });
    }

    //  Hanya siswa milik manager yang sedang login
    const student = await userModel
      .findOne({ _id: id, role: "student", manager: req.user._id })
      .select("name email courses photo");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({
      message: "Get student successfully",
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const postStudent = async (req, res) => {
  try {
    const body = req.body;

    const parse = mutateStudentSchema.safeParse(body);

    if (!parse.success) {
      const errorMessages = parse.error.issues.map((e) => e.message);

      return res.status(400).json({
        message: "Validation Error",
        data: null,
        errors: errorMessages,
      });
    }

    // Cegah email ganda (case-insensitive)
    const emailTaken = await userModel.exists({
      email: caseInsensitiveExact(parse.data.email),
    });

    if (emailTaken) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // ✅ Foto wajib ada (multer v2 memoryStorage → upload manual ke Cloudinary)
    if (!req.file) {
      return res.status(400).json({ message: "Photo is required" });
    }

    const photoUrl = (await uploadStudentPhoto(req.file)).secure_url;

    const hashedPassword = bcrypt.hashSync(body.password, 12);

    const student = new userModel({
      name: parse.data.name,
      email: parse.data.email,
      password: hashedPassword,
      photo: photoUrl, // Full URL dari Cloudinary
      role: "student",
      manager: req.user._id,
    });
    await student.save();

    // Jangan pernah kirim hash password ke client
    const studentResponse = student.toObject();
    delete studentResponse.password;

    return res.status(201).json({
      message: "Student created successfully",
      data: studentResponse,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Frontend saat mode edit mengirim FormData dengan nilai undefined → menjadi string
    // "undefined"/"null"/"". Nilai seperti itu BUKAN password, jadi harus dianggap kosong;
    // kalau tidak, password siswa akan ter-reset menjadi literal "undefined".
    if (
      typeof body.password !== "string" ||
      ["", "undefined", "null"].includes(body.password.trim().toLowerCase())
    ) {
      delete body.password;
    }

    const parse = mutateStudentSchema
      .partial({
        password: true,
      })
      .safeParse(body);

    if (!parse.success) {
      const errorMessages = parse.error.issues.map((e) => e.message);

      return res.status(400).json({
        message: "Validation Error",
        data: null,
        errors: errorMessages,
      });
    }

    //  Hanya siswa milik manager yang sedang login
    const student = await userModel.findOne({
      _id: id,
      role: "student",
      manager: req.user._id,
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Cegah bentrok email dengan user lain (case-insensitive)
    const emailTaken = await userModel.exists({
      _id: { $ne: student._id },
      email: caseInsensitiveExact(parse.data.email),
    });

    if (emailTaken) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = parse.data.password
      ? bcrypt.hashSync(parse.data.password, 12)
      : student.password;

    let photoUrl = student.photo;

    // ✅ Jika ada file baru, upload ke Cloudinary dan hapus yang lama
    if (req.file) {
      const cloudinaryResult = await uploadStudentPhoto(req.file);
      photoUrl = cloudinaryResult.secure_url;

      // Hapus file lama dari Cloudinary
      if (student.photo) {
        try {
          await deleteFromCloudinary(student.photo);
        } catch (cloudinaryError) {
          console.error("Cloudinary delete error:", cloudinaryError);
        }
      }
    }

    const updatedStudent = await userModel
      .findOneAndUpdate(
        { _id: student._id, role: "student", manager: req.user._id },
        {
          name: parse.data.name,
          email: parse.data.email,
          password: hashedPassword,
          photo: photoUrl,
          // Menandai waktu ganti password → semua token lama otomatis invalid (lihat verifyToken)
          ...(parse.data.password ? { passwordChangedAt: new Date() } : {}),
        },
        { new: true },
      )
      .select("-password");

    return res.status(201).json({
      message: "Update created successfully",
      data: updatedStudent,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Student not found" });
    }

    //  Hanya siswa milik manager yang sedang login
    const student = await userModel.findOne({
      _id: id,
      role: "student",
      manager: req.user._id,
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Hapus referensi siswa dari semua course.
    // Sebelumnya memakai userModel.findOneAndUpdate({ students: id }) padahal field
    // `students` ada di model Course, jadi query ini tidak pernah match.
    await courseModel.updateMany(
      {
        students: student._id,
      },
      {
        $pull: {
          students: student._id,
        },
      },
    );

    // ✅ Hapus dari Cloudinary
    if (student.photo) {
      try {
        await deleteFromCloudinary(student.photo);
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
      }
    }

    await userModel.findByIdAndDelete(student._id);

    return res.status(200).json({
      message: "Delete student successfully",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const getCoursesStudents = async (req, res) => {
  try {
    const user = await userModel.findById(req.user._id).populate({
      path: "courses",
      select: "name category thumbnail",
      populate: {
        path: "category",
        select: "name",
      },
    });

    // ✅ Cloudinary sudah return full URL
    const response = user.courses.map((item) => {
      return {
        ...item.toObject(),
        thumbnail_url: item.thumbnail, // Sudah full URL dari Cloudinary
      };
    })
    return res.status(200).json({
      message: "Get courses successfully",
      data: response,
    });
  } catch (error) {
     return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
}

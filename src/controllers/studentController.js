import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import { mutateCourseSchema, mutateStudentSchema } from "../utils/schema.js";
import cloudinary, { uploadStudentPhoto, deleteFromCloudinary } from "../config/cloudinary.js";

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
      error: error.message,
    });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await userModel.findById(id).select("name email courses photo");

    return res.status(200).json({
      message: "Get student successfully",
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
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

    // ✅ Upload foto ke Cloudinary secara manual (kompatibel multer v2)
    let photoUrl = null;
    if (req.file) {
      const cloudinaryResult = await uploadStudentPhoto(req.file);
      photoUrl = cloudinaryResult.secure_url;
    }

    const hashedPassword = await bcrypt.hashSync(body.password, 12);

    const student = new userModel({
      name: parse.data.name,
      email: parse.data.email,
      password: hashedPassword,
      photo: photoUrl, // Full URL dari Cloudinary
      role: "student",
      manager: req.user._id,
    });
    await student.save();
    return res.status(201).json({
      message: "Student created successfully",
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

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

    const student = await userModel.findById(id);

    const hashedPassword = parse.data.password
      ? await bcrypt.hashSync(parse.data.password, 12)
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

    await userModel.findByIdAndUpdate(id, {
      name: parse.data.name,
      email: parse.data.email,
      password: hashedPassword,
      photo: photoUrl,
    });

    await student.save();
    return res.status(201).json({
      message: "Update created successfully",
      data: student,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await userModel.findById(id);

    await userModel.findOneAndUpdate(
      {
        students: id,
      },
      {
        $pull: {
          students: id,
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

    await userModel.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Delete student successfully",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
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
      error: error.message,
    });
  }
}

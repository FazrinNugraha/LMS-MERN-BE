import mongoose from "mongoose";
import courseModel from "../models/courseModel.js";
import { mutateCourseSchema } from "../utils/schema.js";
import userModel from "../models/userModel.js";
import categoryModel from "../models/categoryModel.js";
import courseDetailModel from "../models/courseDetailModel.js";
import cloudinary, { uploadCourseThumbnail, deleteFromCloudinary } from "../config/cloudinary.js";

export const getCourses = async (req, res) => {
  try {
    const courses = await courseModel
      .find({
        manager: req.user?._id,
      })

      .select("name thumbnail")
      .populate({
        path: "category",
        select: "name -_id",
      })

      .populate({
        path: "students",
        select: "name ",
      });

    // ✅ Cloudinary sudah return full URL, tidak perlu concat lagi
    const response = courses.map((item) => {
      return {
        ...item.toObject(),
        thumbnailUrl: item.thumbnail, // Sudah full URL dari Cloudinary
        totalStudents: item.students.length,
      };
    });

    return res.json({
      message: "Get courses succses",
      data: response,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Internal Error Server",
    });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const { preview } = req.query;

    // 🔒 Otorisasi: hanya manager pemilik course atau student yang ter-enroll
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Course not found" });
    }

    const courseAccess = await courseModel.findById(id).select("manager students");

    if (!courseAccess) {
      return res.status(404).json({ message: "Course not found" });
    }

    const currentUserId = req.user._id.toString();
    const isOwner = courseAccess.manager?.toString() === currentUserId;
    const isEnrolled = (courseAccess.students ?? []).some(
      (studentId) => studentId.toString() === currentUserId
    );

    if (!isOwner && !isEnrolled) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you do not have access to this course",
      });
    }

    const course = await courseModel
      .findById(id)
      .populate({
        path: "category",
        select: "name -_id",
      })
      .populate({
        path: "details",
        select: preview === "true" ? "title type youtubeId text" : "title type",
      });

    const courseData = course.toObject();

    // Student hanya boleh melihat info course-nya, jangan bocorkan daftar siswa & id manager
    if (!isOwner) {
      delete courseData.students;
      delete courseData.manager;
    }

    // ✅ Cloudinary sudah return full URL
    return res.json({
      message: "Get course by id success",
      data: {
        ...courseData,
        thumbnail_url: course.thumbnail, // Sudah full URL dari Cloudinary
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const postCourse = async (req, res) => {
  try {
    const body = req.body;

    // Validasi input pakai Zod
    const parse = mutateCourseSchema.safeParse(body);
    if (!parse.success) {
      const errorMessages = parse.error.issues.map((e) => e.message);

      return res.status(400).json({
        message: "Validation Error",
        data: null,
        errors: errorMessages,
      });
    }

    // ✅ Cari kategori di collection Category
    const category = await categoryModel.findById(parse.data.categoryId);
    if (!category) {
      return res.status(400).json({
        message: "Category not found",
      });
    }

    // ✅ Cek apakah file ada
    if (!req.file) {
      return res.status(400).json({
        message: "Thumbnail is required",
      });
    }

    // ✅ Upload ke Cloudinary secara manual (kompatibel multer v2)
    const cloudinaryResult = await uploadCourseThumbnail(req.file);

    // ✅ Buat course baru - Simpan full URL dari Cloudinary
    const course = new courseModel({
      name: parse.data.name,
      category: category._id,
      description: parse.data.description,
      tagline: parse.data.tagline,
      thumbnail: cloudinaryResult.secure_url, // Full URL dari Cloudinary
      manager: req.user?._id,
    });

    await course.save();

    // Update category dan user
    await categoryModel.findByIdAndUpdate(category._id, {
      $addToSet: { courses: course._id },
    });

    await userModel.findByIdAndUpdate(req.user?._id, {
      $addToSet: { courses: course._id },
    });

    return res.status(201).json({
      message: "Course created successfully",
      data: course,
    });
  } catch (error) {
    console.error("Error creating course:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const body = req.body;

    const courseId = req.params.id;

    // Validasi input pakai Zod
    const parse = mutateCourseSchema.safeParse(body);
    if (!parse.success) {
      const errorMessages = parse.error.issues.map((e) => e.message);

      return res.status(400).json({
        message: "Validation Error",
        data: null,
        errors: errorMessages,
      });
    }

    // ✅ Cari kategori di collection Category
    const category = await categoryModel.findById(parse.data.categoryId);
    const oldCourse = await courseModel.findOne({
      _id: courseId,
      manager: req.user._id,
    });

    if (!category) {
      return res.status(400).json({
        message: "Category not found",
      });
    }

    if (!oldCourse) {
      return res.status(404).json({
        message: "Course not found",
      });
    }

    let thumbnailUrl = oldCourse.thumbnail;

    // ✅ Jika ada file baru, upload ke Cloudinary dan hapus yang lama
    if (req.file) {
      // Upload file baru ke Cloudinary
      const cloudinaryResult = await uploadCourseThumbnail(req.file);
      thumbnailUrl = cloudinaryResult.secure_url;

      // Hapus file lama dari Cloudinary
      if (oldCourse.thumbnail) {
        try {
          await deleteFromCloudinary(oldCourse.thumbnail);
        } catch (cloudinaryError) {
          console.error("Cloudinary delete error:", cloudinaryError);
          // Lanjutkan update meskipun gagal hapus file lama
        }
      }
    }

    await courseModel.findByIdAndUpdate(courseId, {
      name: parse.data.name,
      category: category._id,
      description: parse.data.description,
      tagline: parse.data.tagline,
      thumbnail: thumbnailUrl,
      manager: req.user._id,
    });

    return res.status(201).json({
      message: "Updated courses successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Course not found" });
    }

    const course = await courseModel.findOne({ _id: id, manager: req.user._id });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // ✅ Hapus dari Cloudinary
    if (course.thumbnail) {
      try {
        await deleteFromCloudinary(course.thumbnail);
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
        // Lanjutkan hapus dari database meskipun gagal hapus dari Cloudinary
      }
    }

    // Hapus course dari database (hook findOneAndDelete juga membersihkan
    // category.courses, courseDetail, dan students[].courses)
    await courseModel.findByIdAndDelete(id);

    // Bersihkan referensi course di data manager (sebelumnya tidak dibersihkan → data stale)
    await userModel.findByIdAndUpdate(course.manager, {
      $pull: { courses: course._id },
    });

    return res.json({
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const postContentCourse = async (req, res) => {
  try {
    const body = req.body;

    const course = await courseModel.findOne({
      _id: body.courseId,
      manager: req.user._id,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const postContent = new courseDetailModel({
      title: body.title,
      type: body.type,
      course: course._id,
      youtubeId: body.youtubeId,
      text: body.text,
    });
    await postContent.save();
    await courseModel.findByIdAndUpdate(
      course._id,
      {
        $addToSet: { details: postContent._id },
      },
      { new: true },
    );
    return res.status(201).json({
      message: "Content created successfully",
      data: postContent,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const updateContentCourse = async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body;

    const content = await courseDetailModel.findById(id);

    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    const isContentOwner = await courseModel.exists({
      _id: content.course,
      manager: req.user._id,
    });

    if (!isContentOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you do not have access to this content",
      });
    }

    const course = await courseModel.findOne({
      _id: body.courseId,
      manager: req.user._id,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    await courseDetailModel.findByIdAndUpdate(id, {
      title: body.title,
      type: body.type,
      course: course._id,
      youtubeId: body.youtubeId,
      text: body.text,
    }, { new: true });


    return res.status(201).json({
      message: "Content updated successfully"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const deleteContentCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await courseDetailModel.findById(id);

    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    const isContentOwner = await courseModel.exists({
      _id: content.course,
      manager: req.user._id,
    });

    if (!isContentOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you do not have access to this content",
      });
    }

    await courseDetailModel.findByIdAndDelete(id);

    return res.json({
      message: "Content deleted successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
}

export const getDetailContent = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await courseDetailModel.findById(id);

    if (!content) {
      return res.status(404).json({ message: "Content not found" });
    }

    const isContentOwner = await courseModel.exists({
      _id: content.course,
      manager: req.user._id,
    });

    if (!isContentOwner) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: you do not have access to this content",
      });
    }

    return res.json({
      message: "Get detail content success",
      data: content
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    })
  }
}

export const getStudentsByCourseId = async (req,res) => {
  try {

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Course not found" });
    }

    const course = await courseModel
      .findOne({ _id: id, manager: req.user._id })
      .select('name')
      .populate({
        path: "students",
        select: "name email photo",
      })

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // filter(Boolean) supaya tetap aman kalau ada referensi siswa yang sudah dihapus
    const studentMap = course.students.filter(Boolean).map((item) => {
      return {
        ...item.toObject(),
        photo_url: item.photo, // ✅ Sudah full Cloudinary URL
      }
    })    

    return res.json({
      message: "Get students by course id success",
      data: {
        ...course.toObject(),
        students: studentMap
      }
    })
    
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    })
  }
}

export const postStudentToCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(studentId)
    ) {
      return res.status(404).json({ message: "Course or student not found" });
    }

    // 🔒 Course harus milik manager yang sedang login
    const course = await courseModel.findOne({ _id: id, manager: req.user._id });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 🔒 Student harus benar-benar siswa milik manager yang sedang login
    const student = await userModel.findOne({
      _id: studentId,
      role: "student",
      manager: req.user._id,
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Hindari relasi ganda kalau siswa sudah terdaftar di course ini
    const alreadyEnrolled = (course.students ?? []).some(
      (enrolledId) => enrolledId.toString() === student._id.toString(),
    );

    if (alreadyEnrolled) {
      return res.json({ message: "Student already added to this course" });
    }

    await userModel.findByIdAndUpdate(studentId, {
      $addToSet: { 
        courses: id 
      },
    }); 

    await courseModel.findByIdAndUpdate(id, {
      $addToSet: { 
        students: studentId 
      },
    });

    return res.json({
      message: "Student added to course successfully"
    })
    
  } catch (error) {
        return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    })
  }
}

export const deletetToCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(studentId)
    ) {
      return res.status(404).json({ message: "Course or student not found" });
    }

    // 🔒 Course harus milik manager yang sedang login
    const course = await courseModel.findOne({ _id: id, manager: req.user._id });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // 🔒 Student harus benar-benar siswa milik manager yang sedang login
    const student = await userModel.findOne({
      _id: studentId,
      role: "student",
      manager: req.user._id,
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await userModel.findByIdAndUpdate(studentId, {
      $pull: {
        courses: id 
      },
    }); 

    await courseModel.findByIdAndUpdate(id, {
      $pull: {
        students: studentId 
      },
    });

    return res.json({
      message: "Delete to course successfully"
    })
    
  } catch (error) {
        return res.status(500).json({
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    })
  }
}



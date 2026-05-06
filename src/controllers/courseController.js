import courseModel from "../models/courseModel.js";
import { mutateCourseSchema } from "../utils/schema.js";
import userModel from "../models/userModel.js";
import categoryModel from "../models/categoryModel.js";
import courseDetailModel from "../models/courseDetailModel.js";
import cloudinary, { uploadCourseThumbnail, deleteFromCloudinary } from "../config/cloudinary.js";

export const getCourses = async (req, res) => {
  try {
    console.log("req.user._id:", req.user?._id);
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

export const getCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find();

    return res.json({
      message: "Get categories success",
      data: categories,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const { preview } = req.query;

    const course = await courseModel
      .findById(id)
      .populate({
        path: "category",
        select: "name -_id",
      })
      .populate({
        path: "details",
        select: "title type",
      })



      .populate({
        path: "details",
        select: preview === "true" ? "title type youtubeId text" : "title type",
      });

    // ✅ Cloudinary sudah return full URL
    return res.json({
      message: "Get course by id success",
      data: {
        ...course.toObject(),
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
    console.log("req.body:", body);
    console.log("req.file:", req.file ? { originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } : null);

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
    console.log("Cloudinary URL:", cloudinaryResult.secure_url);

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
      $push: { courses: course._id },
    });

    await userModel.findByIdAndUpdate(req.user?._id, {
      $push: { courses: course._id },
    });

    return res.status(201).json({
      message: "Course created successfully",
      data: course,
    });
  } catch (error) {
    console.error("Error creating course:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
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
    const oldCourse = await courseModel.findById(courseId);

    if (!category) {
      return res.status(400).json({
        message: "Category not found",
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
      error: error.message,
    });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await courseModel.findById(id);

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

    // Hapus course dari database
    await courseModel.findByIdAndDelete(id);

    return res.json({
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

export const postContentCourse = async (req, res) => {
  try {
    const body = req.body;

    const course = await courseModel.findById(body.courseId);

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
        $push: { details: postContent._id },
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
      error: error.message,
    });
  }
};

export const updateContentCourse = async (req, res) => {
  try {
    const { id } = req.params
    const body = req.body;

    const course = await courseModel.findById(body.courseId);

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
      error: error.message,
    });
  }
};

export const deleteContentCourse = async (req, res) => {
  try {
    const { id } = req.params;

    await courseDetailModel.findByIdAndDelete(id);

    return res.json({
      message: "Content deleted successfully"
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
}

export const getDetailContent = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await courseDetailModel.findById(id);

    return res.json({
      message: "Get detail content success",
      data: content
    })
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    })
  }
}

export const getStudentsByCourseId = async (req,res) => {
  try {

    const { id } = req.params;

    const course = await courseModel.findById(id).select('name').populate({
      path: "students",
      select: "name email photo",
    })

    const studentMap = course?.students?.map((item) => {
      return {
        ...item.toObject(),
        photo_url: item.photo, // ✅ Sudah full Cloudinary URL
      }
    })    

    return res.json({
      message: "Get students by course id success",
      data: {
        ...course,
        students: studentMap
      }
    })
    
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    })
  }
}

export const postStudentToCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    await userModel.findByIdAndUpdate(studentId, {
      $push: { 
        courses: id 
      },
    }); 

    await courseModel.findByIdAndUpdate(id, {
      $push: { 
        students: studentId 
      },
    });

    return res.json({
      message: "Student added to course successfully"
    })
    
  } catch (error) {
        return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    })
  }
}

export const deletetToCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

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
      error: error.message,
    })
  }
}



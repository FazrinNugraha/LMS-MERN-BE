import courseModel from "../models/courseModel.js";
import userModel from "../models/userModel.js";

export const getOverview = async (req, res) => {
  try {
    const totalCourse = await courseModel
      .find({
        manager: req.user._id,
      })
      .countDocuments();

    // Fix: Count unique students instead of total enrollments
    const totalStudent = await userModel
      .find({
        role: "student",
        manager: req.user._id,
      })
      .countDocuments();

    const coursesVideos = await courseModel
      .find({
        manager: req.user._id,
      })
      .populate({
        path: "details",
        select: "type name",
        match: {
          type: "video",
        },
      });

    const totalVideo = coursesVideos.reduce(
      (acc, curr) => acc + curr.details.length,
      0,
    );

    const coursesTexts = await courseModel
      .find({
        manager: req.user._id,
      })
      .populate({
        path: "details",
        select: "type name",
        match: {
          type: "text",
        },
      });

    const totalTexts = coursesTexts.reduce(
      (acc, curr) => acc + curr.details.length,
      0,
    );

    const courseList = await courseModel
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

    const imageUrl = process.env.APP_URL + "/uploads/courses/";

    const responseCourses = courseList.map((item) => {
      return {
        ...item.toObject(),
        thumbnailUrl: imageUrl + item.thumbnail,
        totalStudents: item.students.length,
      };
    });

    const students = await userModel
      .find({
        role: "student",
        manager: req.user._id,
      })
      .select("name courses photo");

    const photoUrl = process.env.APP_URL + "/uploads/students/";

    const responseStudents = students.map((item) => {
      return {
        ...item.toObject(),
        photo_url: photoUrl + item.photo,
      };
    });

    return res.json({
      message: "Get overview successfully",
      data: {
        totalCourse,
        totalStudent,
        totalVideo,
        totalTexts,
        courses: responseCourses,
        students: responseStudents,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

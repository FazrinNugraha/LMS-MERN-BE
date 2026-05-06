import express from 'express';
import { deleteContentCourse, deletetToCourseById, getCourseById, getCourses, getStudentsByCourseId, postContentCourse, postStudentToCourseById, updateContentCourse, updateCourse } from '../controllers/courseController.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { upload } from '../utils/multer.js';
import { postCourse } from '../controllers/courseController.js';
import { deleteCourse } from '../controllers/courseController.js';
import { addStudentToCourseSchema, mutateContentSchema } from '../utils/schema.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { getDetailContent } from '../controllers/courseController.js';

const courseRoutes = express.Router()

courseRoutes.get('/courses', verifyToken, getCourses)
courseRoutes.get('/courses/:id', verifyToken, getCourseById)
courseRoutes.post('/courses', verifyToken, upload.single('thumbnail'), postCourse)
courseRoutes.put('/courses/:id', verifyToken, upload.single('thumbnail'), updateCourse)
courseRoutes.delete('/courses/:id', verifyToken, deleteCourse)

courseRoutes.post('/courses/contents', verifyToken, validateRequest(mutateContentSchema), postContentCourse)
courseRoutes.put('/courses/contents/:id', verifyToken, validateRequest(mutateContentSchema), updateContentCourse)
courseRoutes.delete('/courses/contents/:id', verifyToken, deleteContentCourse)
courseRoutes.get('/courses/contents/:id', verifyToken, getDetailContent)

courseRoutes.get('/courses/students/:id', verifyToken, getStudentsByCourseId)
courseRoutes.post('/courses/students/:id', verifyToken, validateRequest(addStudentToCourseSchema), postStudentToCourseById)
courseRoutes.put('/courses/students/:id', verifyToken, validateRequest(addStudentToCourseSchema), deletetToCourseById)


export default courseRoutes;
import express from 'express';
import { deleteContentCourse, deletetToCourseById, getCourseById, getCourses, getStudentsByCourseId, postContentCourse, postStudentToCourseById, updateContentCourse, updateCourse } from '../controllers/courseController.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';
import { upload } from '../utils/multer.js';
import { postCourse } from '../controllers/courseController.js';
import { deleteCourse } from '../controllers/courseController.js';
import { addStudentToCourseSchema, mutateContentSchema } from '../utils/schema.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { getDetailContent } from '../controllers/courseController.js';

const courseRoutes = express.Router()

// Manager only
courseRoutes.get('/courses', verifyToken, verifyRole('manager'), getCourses)
courseRoutes.post('/courses', verifyToken, verifyRole('manager'), upload.single('thumbnail'), postCourse)
courseRoutes.put('/courses/:id', verifyToken, verifyRole('manager'), upload.single('thumbnail'), updateCourse)
courseRoutes.delete('/courses/:id', verifyToken, verifyRole('manager'), deleteCourse)

courseRoutes.post('/courses/contents', verifyToken, verifyRole('manager'), validateRequest(mutateContentSchema), postContentCourse)
courseRoutes.put('/courses/contents/:id', verifyToken, verifyRole('manager'), validateRequest(mutateContentSchema), updateContentCourse)
courseRoutes.delete('/courses/contents/:id', verifyToken, verifyRole('manager'), deleteContentCourse)
courseRoutes.get('/courses/contents/:id', verifyToken, verifyRole('manager'), getDetailContent)

courseRoutes.get('/courses/students/:id', verifyToken, verifyRole('manager'), getStudentsByCourseId)
courseRoutes.post('/courses/students/:id', verifyToken, verifyRole('manager'), validateRequest(addStudentToCourseSchema), postStudentToCourseById)
courseRoutes.put('/courses/students/:id', verifyToken, verifyRole('manager'), validateRequest(addStudentToCourseSchema), deletetToCourseById)

// Manager pemilik course ATAU student yang ter-enroll (dicek di getCourseById)
courseRoutes.get('/courses/:id', verifyToken, getCourseById)


export default courseRoutes;
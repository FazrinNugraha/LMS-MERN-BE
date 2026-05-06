import express from 'express';
import { deleteStudent, getStudent, updateStudent } from '../controllers/studentController.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { upload } from '../utils/multer.js';
import { getStudentById, postStudent } from '../controllers/studentController.js';
import { getCoursesStudents } from '../controllers/studentController.js';

const studentRoutes = express.Router();

studentRoutes.get('/students', verifyToken, getStudent);
studentRoutes.get('/students/courses', verifyToken, getCoursesStudents); // ⚠️ HARUS sebelum :id
studentRoutes.get('/students/:id', verifyToken, getStudentById);
studentRoutes.post('/students', verifyToken, upload.single('avatar'), postStudent);
studentRoutes.put('/students/:id', verifyToken, upload.single('avatar'), updateStudent);
studentRoutes.delete('/students/:id', verifyToken, deleteStudent);




export default studentRoutes;
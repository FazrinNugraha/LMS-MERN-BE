import express from 'express';
import { deleteStudent, getStudent, updateStudent } from '../controllers/studentController.js';
import { verifyToken } from '../middlewares/verifyToken.js';
import { verifyRole } from '../middlewares/verifyRole.js';
import { upload } from '../utils/multer.js';
import { getStudentById, postStudent } from '../controllers/studentController.js';
import { getCoursesStudents } from '../controllers/studentController.js';

const studentRoutes = express.Router();

// Self-scoped: hanya mengembalikan data milik user yang login → dipakai dashboard student
studentRoutes.get('/students/courses', verifyToken, getCoursesStudents); // ⚠️ HARUS sebelum :id

// Manager only (ditambah pengecekan kepemilikan data di controller)
studentRoutes.get('/students', verifyToken, verifyRole('manager'), getStudent);
studentRoutes.get('/students/:id', verifyToken, verifyRole('manager'), getStudentById);
studentRoutes.post('/students', verifyToken, verifyRole('manager'), upload.single('avatar'), postStudent);
studentRoutes.put('/students/:id', verifyToken, verifyRole('manager'), upload.single('avatar'), updateStudent);
studentRoutes.delete('/students/:id', verifyToken, verifyRole('manager'), deleteStudent);




export default studentRoutes;
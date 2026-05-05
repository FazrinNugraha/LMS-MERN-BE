import express from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const categoryRoutes = express.Router();

// Public routes
categoryRoutes.get("/categories", getAllCategories);
categoryRoutes.get("/categories/:id", getCategoryById);

// Protected routes (require authentication)
categoryRoutes.post("/categories", verifyToken, createCategory);
categoryRoutes.put("/categories/:id", verifyToken, updateCategory);
categoryRoutes.delete("/categories/:id", verifyToken, deleteCategory);

export default categoryRoutes;

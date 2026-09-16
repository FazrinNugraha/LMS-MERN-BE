import express from "express";
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { verifyToken } from "../middlewares/verifyToken.js";
import { verifyRole } from "../middlewares/verifyRole.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { mutateCategorySchema } from "../utils/schema.js";

const categoryRoutes = express.Router();

// Public routes (hanya metadata kategori, tanpa daftar course)
categoryRoutes.get("/categories", getAllCategories);
categoryRoutes.get("/categories/:id", getCategoryById);

// Protected routes (manager only)
categoryRoutes.post("/categories", verifyToken, verifyRole("manager"), validateRequest(mutateCategorySchema), createCategory);
categoryRoutes.put("/categories/:id", verifyToken, verifyRole("manager"), validateRequest(mutateCategorySchema), updateCategory);
categoryRoutes.delete("/categories/:id", verifyToken, verifyRole("manager"), deleteCategory);

export default categoryRoutes;

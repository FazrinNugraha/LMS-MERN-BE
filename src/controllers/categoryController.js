import mongoose from "mongoose";
import Category from "../models/categoryModel.js";
import { caseInsensitiveExact } from "../utils/regex.js";

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .select("name courses createdAt updatedAt")
      .sort({ createdAt: -1 });

    // ⚠️ Endpoint ini publik → jangan kirim daftar course (id/thumbnail),
    // cukup jumlahnya saja supaya id course tidak bisa di-enumerate.
    const categoriesWithCount = categories.map((category) => ({
      _id: category._id,
      name: category.name,
      totalCourses: category.courses?.length ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: categoriesWithCount,
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get categories",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Get single category by ID
export const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id).select(
      "name courses createdAt updatedAt",
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: category._id,
        name: category.name,
        totalCourses: category.courses?.length ?? 0,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get category",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Create new category
export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Check if category already exists (exact match case-insensitive).
    // Regex di-escape supaya input user tidak bisa jadi regex injection / ReDoS.
    const existingCategory = await Category.findOne({
      name: caseInsensitiveExact(name),
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    const newCategory = new Category({
      name,
      courses: [],
    });

    await newCategory.save();

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category exists
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if new name already exists (excluding current category)
    const existingCategory = await Category.findOne({
      name: caseInsensitiveExact(name),
      _id: { $ne: id },
    });

    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category with this name already exists",
      });
    }

    category.name = name;
    await category.save();

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if category has courses
    if (category.courses.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${category.courses.length} course(s) associated with it. Please reassign or delete the courses first.`,
      });
    }

    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

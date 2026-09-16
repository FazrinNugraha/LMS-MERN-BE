import z from "zod";

export const exampleSchema = z.object({
    name: z.string().min(3),
    university: z.string().min(3),
    town: z.string().min(3)
})

export const signUpSchema = z.object({
    name: z.string().min(5, "Name minimal 5 karakter"),
    email: z.string().email(),
    password: z.string().min(8, "Password minimal 8 karakter")
})

// PENTING: aturan password untuk LOGIN sengaja tidak memakai min 8.
// Kalau ikut dinaikkan, user lama yang passwordnya pendek tidak akan bisa login.
export const signInSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, "Password wajib diisi")
})

export const mutateCourseSchema = z.object({
    name: z.string().min(5),
    categoryId: z.string().min(1),
    tagline: z.string().min(5),
    description: z.string().min(10),
})

export const mutateContentSchema = z.object({
    title: z.string().min(5),
    type: z.string().min(3),
    youtubeId: z.string().optional(),
    text: z.string().optional(),
    courseId: z.string().min(5),
})

export const mutateStudentSchema = z.object ({
    name: z.string().min(5),
    email: z.string().email(),
    password: z.string().min(8, "Password minimal 8 karakter"),
})

export const addStudentToCourseSchema = z.object({
    studentId: z.string().min(5),
})

export const mutateCategorySchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Nama kategori minimal 2 karakter")
        .max(60, "Nama kategori maksimal 60 karakter"),
})
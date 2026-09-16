/**
 * Bersihkan relasi yang tidak konsisten antara Course.students <-> User.courses.
 *
 * Jalankan MANUAL dari folder backend:
 *   node scripts/cleanup-relations.js            # dry-run (hanya laporan)
 *   node scripts/cleanup-relations.js --apply    # benar-benar membersihkan
 *
 * Yang DIBERSIHKAN (dengan --apply):
 *  1. Course.students memuat id user yang sudah tidak ada (user dihapus).
 *  2. Course.students memuat id yang bukan role "student" (mis. manager).
 *  3. User.courses memuat id course yang sudah tidak ada (course dihapus).
 *
 * Yang HANYA DILAPORKAN (tidak diubah otomatis, karena bisa jadi disengaja):
 *  4. Relasi satu arah: course terhubung ke siswa, tapi user.courses tidak memuat
 *     course tersebut (atau sebaliknya).
 */
import "dotenv/config";
import mongoose from "mongoose";
import userModel from "../src/models/userModel.js";
import courseModel from "../src/models/courseModel.js";

const apply = process.argv.includes("--apply");

const toObjectIds = (ids) =>
    ids
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

const run = async () => {
    if (!process.env.DATABASES_URL) {
        console.error("DATABASES_URL belum dikonfigurasi di .env");
        process.exit(1);
    }

    await mongoose.connect(process.env.DATABASES_URL, { serverSelectionTimeoutMS: 10000 });
    console.log("Terhubung ke database.");

    const users = await userModel.find({}, "_id name role courses").lean();
    const courses = await courseModel.find({}, "_id name manager students").lean();

    const userById = new Map(users.map((u) => [String(u._id), u]));
    const courseById = new Map(courses.map((c) => [String(c._id), c]));

    const invalidInCourse = [];
    const invalidInUser = [];
    const oneWay = [];

    for (const course of courses) {
        const bad = [];

        for (const studentId of course.students ?? []) {
            const key = String(studentId);
            const user = userById.get(key);

            if (!user) {
                bad.push({ key, reason: "user sudah tidak ada" });
                continue;
            }

            if (user.role !== "student") {
                bad.push({ key, reason: `role=${user.role} (bukan student)` });
                continue;
            }

            const linked = (user.courses ?? []).some((cid) => String(cid) === String(course._id));
            if (!linked) {
                oneWay.push({ courseName: course.name, userName: user.name, arah: "course -> user" });
            }
        }

        if (bad.length) invalidInCourse.push({ course, bad });
    }

    for (const user of users) {
        const badCourseIds = (user.courses ?? [])
            .filter((cid) => !courseById.has(String(cid)))
            .map((cid) => String(cid));

        if (badCourseIds.length) invalidInUser.push({ user, badCourseIds });
    }

    console.log(`\nTotal user: ${users.length} | total course: ${courses.length}`);

    console.log(`\n[1&2] Course.students dengan referensi tidak valid: ${invalidInCourse.length} course`);
    invalidInCourse.forEach(({ course, bad }) => {
        console.log(`  - "${course.name}" (id=${course._id})`);
        bad.forEach((b) => console.log(`      ${b.key} -> ${b.reason}`));
    });

    console.log(`\n[3] User.courses yang menunjuk course hilang: ${invalidInUser.length} user`);
    invalidInUser.forEach(({ user, badCourseIds }) => {
        console.log(`  - ${user.name} (id=${user._id}) -> ${badCourseIds.join(", ")}`);
    });

    console.log(`\n[4] Relasi satu arah (dilaporkan saja): ${oneWay.length}`);
    oneWay.slice(0, 20).forEach((o) => {
        console.log(`  - course "${o.courseName}" <-> siswa "${o.userName}" (${o.arah})`);
    });
    if (oneWay.length > 20) console.log(`  ... dan ${oneWay.length - 20} lainnya`);

    if (!apply) {
        console.log(
            "\nMODE DRY-RUN: tidak ada data yang diubah. Tambahkan --apply untuk membersihkan [1], [2], dan [3].",
        );
        await mongoose.disconnect();
        return;
    }

    let cleanedCourses = 0;
    for (const { course, bad } of invalidInCourse) {
        const idsToRemove = toObjectIds(bad.map((b) => b.key));
        if (idsToRemove.length === 0) continue;

        await courseModel.updateOne(
            { _id: course._id },
            { $pull: { students: { $in: idsToRemove } } },
        );
        cleanedCourses++;
    }

    let cleanedUsers = 0;
    for (const { user, badCourseIds } of invalidInUser) {
        const idsToRemove = toObjectIds(badCourseIds);
        if (idsToRemove.length === 0) continue;

        await userModel.updateOne(
            { _id: user._id },
            { $pull: { courses: { $in: idsToRemove } } },
        );
        cleanedUsers++;
    }

    console.log(`\nSelesai. ${cleanedCourses} course & ${cleanedUsers} user dibersihkan.`);
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("Gagal:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});

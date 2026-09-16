/**
 * Audit data: mendeteksi akun siswa yang password-nya ter-reset menjadi
 * password literal (mis. "undefined") akibat bug lama di form edit siswa FE
 * (FormData mengirim string "undefined" karena field password tidak ada saat mode edit).
 *
 * Jalankan MANUAL dari folder backend:
 *   node scripts/audit-student-passwords.js
 *
 * READ-ONLY: skrip ini tidak mengubah data apa pun.
 * Catatan: bcryptjs dijalankan per akun, jadi untuk data besar butuh beberapa saat.
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import userModel from "../src/models/userModel.js";

const SUSPECT_PASSWORDS = ["undefined", "null", ""];

const run = async () => {
    if (!process.env.DATABASES_URL) {
        console.error("DATABASES_URL belum dikonfigurasi di .env");
        process.exit(1);
    }

    await mongoose.connect(process.env.DATABASES_URL, { serverSelectionTimeoutMS: 10000 });
    console.log("Terhubung ke database.");

    const students = await userModel
        .find({ role: "student" }, "name email password createdAt updatedAt")
        .lean();

    console.log(`Total akun siswa diperiksa: ${students.length}`);
    console.log("(bcrypt memeriksa tiap akun, mohon tunggu...)\n");

    const hits = [];

    for (let i = 0; i < students.length; i++) {
        const student = students[i];

        if (student.password) {
            for (const candidate of SUSPECT_PASSWORDS) {
                if (bcrypt.compareSync(candidate, student.password)) {
                    hits.push({ ...student, candidate });
                    break;
                }
            }
        }

        if ((i + 1) % 25 === 0) {
            console.log(`  ... ${i + 1}/${students.length} diperiksa`);
        }
    }

    console.log(`\nAkun dengan password literal: ${hits.length}`);

    hits.forEach((hit) => {
        console.log(
            `  - ${hit.name} <${hit.email}> → password: "${hit.candidate}" | id=${hit._id} | terakhir diubah: ${hit.updatedAt?.toISOString?.() ?? "-"}`,
        );
    });

    if (hits.length === 0) {
        console.log("Tidak ada akun terdampak. Aman.");
    } else {
        console.log("\nRekomendasi:");
        console.log("  1. Reset password akun di atas (menu edit siswa → isi kolom Password).");
        console.log("     Reset otomatis menandai passwordChangedAt → token lama mereka invalid.");
        console.log("  2. Beri tahu siswa terkait untuk mengganti password setelah login.");
    }

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("Gagal:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
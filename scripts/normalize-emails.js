/**
 * Migrasi data: normalisasi email user + deteksi duplikat.
 *
 * Jalankan MANUAL dari folder backend:
 *   node scripts/normalize-emails.js            # dry-run (hanya laporan, tidak mengubah data)
 *   node scripts/normalize-emails.js --apply    # benar-benar mengubah data
 *
 * Yang dilakukan:
 *  - Melaporkan email yang belum lowercase/trim.
 *  - Melaporkan email duplikat (case-insensitive) beserta akun-akunnya.
 *  - Dengan --apply: menulis semua email menjadi lowercase + trim.
 *
 * PENTING: index unik pada field `email` (userModel) hanya bisa dibentuk kalau
 * tidak ada duplikat. Selesaikan duplikatnya dulu (gabungkan/hapus akun), baru
 * jalankan mode --apply. Login sudah case-insensitive, jadi user tidak akan
 * terkunci selama proses ini.
 */
import "dotenv/config";
import mongoose from "mongoose";
import userModel from "../src/models/userModel.js";

const apply = process.argv.includes("--apply");

const run = async () => {
    if (!process.env.DATABASES_URL) {
        console.error("DATABASES_URL belum dikonfigurasi di .env");
        process.exit(1);
    }

    await mongoose.connect(process.env.DATABASES_URL, { serverSelectionTimeoutMS: 10000 });
    console.log("Terhubung ke database.");

    const users = await userModel.find({}, "name email role").lean();
    console.log(`Total user: ${users.length}`);

    const groups = new Map();
    for (const user of users) {
        const key = String(user.email ?? "").trim().toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(user);
    }

    const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);
    const needsNormalize = users.filter(
        (u) => u.email !== String(u.email ?? "").trim().toLowerCase(),
    );

    console.log(`\nEmail perlu dinormalisasi: ${needsNormalize.length}`);
    needsNormalize.forEach((u) => console.log(`  - ${u.email}  (${u.role}, id=${u._id})`));

    console.log(`\nEmail duplikat (case-insensitive): ${duplicates.length}`);
    duplicates.forEach(([email, list]) => {
        console.log(`  - ${email}`);
        list.forEach((u) => console.log(`      id=${u._id} role=${u.role} name=${u.name}`));
    });

    if (!apply) {
        console.log("\nMODE DRY-RUN: tidak ada data yang diubah.");
        console.log("Jalankan ulang dengan --apply untuk menyimpan perubahan.");
        await mongoose.disconnect();
        return;
    }

    if (duplicates.length > 0) {
        console.error(
            "\nDIBATALKAN: masih ada email duplikat. Selesaikan dulu (gabung/hapus akun), lalu jalankan lagi.",
        );
        await mongoose.disconnect();
        process.exit(1);
    }

    let updated = 0;
    for (const user of needsNormalize) {
        const normalized = String(user.email ?? "").trim().toLowerCase();
        await userModel.updateOne({ _id: user._id }, { email: normalized });
        updated++;
    }

    console.log(`\nSelesai. ${updated} email dinormalisasi.`);
    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error("Gagal:", error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});

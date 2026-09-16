/**
 * Escape karakter spesial regex dari input user.
 * Dipakai untuk pencarian exact-match case-insensitive yang aman
 * (mencegah regex injection / ReDoS).
 */
export const escapeRegex = (value) =>
    String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Query case-insensitive exact match untuk field String.
 * Contoh: userModel.findOne({ email: caseInsensitiveExact(body.email) })
 */
export const caseInsensitiveExact = (value) => ({
    $regex: `^${escapeRegex(value)}$`,
    $options: "i",
});
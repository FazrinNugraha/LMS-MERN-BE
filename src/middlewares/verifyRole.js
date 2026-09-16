/**
 * Middleware otorisasi berbasis role.
 * HARUS dipakai SETELAH verifyToken karena membutuhkan req.user.
 *
 * Contoh pemakaian:
 *   courseRoutes.get('/courses', verifyToken, verifyRole('manager'), getCourses)
 */
export const verifyRole = (...allowedRoles) => (req, res, next) => {
    const role = req.user?.role

    if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: you do not have access to this resource',
        })
    }

    next()
}

export default verifyRole
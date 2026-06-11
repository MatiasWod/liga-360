export function requireRole(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                error: 'Forbidden: You do not have permission to perform this action',
                code: 'FORBIDDEN'
            });
        }

        next();
    };
}
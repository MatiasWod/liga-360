import jwt from 'jsonwebtoken';

export function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized: No token provided',
            code: 'UNAUTHORIZED'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        // Si jwt.verify falla (token modificado, falso o expirado), cae aquí
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Unauthorized: Token has expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        return res.status(401).json({
            error: 'Unauthorized: Invalid token',
            code: 'INVALID_TOKEN'
        });
    }
}
import { Router } from 'express';
import { verifyToken, requireRole, ROLES } from '@liga360/shared';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// Administración de usuarios: solo admins (provisionados por env, sin registro).
// El PATCH /users/:userid de verificación de email vive en auth.routes.js (sin token).
const adminOnly = [verifyToken, requireRole([ROLES.ADMIN])];

router.get('/users', ...adminOnly, userController.listUsers);
router.post('/users/:id/ban', ...adminOnly, userController.banUser);
router.delete('/users/:id/ban', ...adminOnly, userController.unbanUser);

export default router;

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest, ApiResponse } from '../types';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
        } as ApiResponse);
      }

      const result = await authService.login(email, password);

      return res.json({
        success: true,
        data: result,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async signup(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name, companyName, role } = req.body;

      if (!email || !password || !name || !companyName) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required',
        } as ApiResponse);
      }

      const result = await authService.signup({
        email,
        password,
        name,
        companyName,
        role,
      });

      return res.status(201).json({
        success: true,
        data: result,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const user = await authService.getCurrentUser(req.user.userId);

      return res.json({
        success: true,
        data: { user },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        } as ApiResponse);
      }

      await authService.changePassword(req.user.userId, currentPassword, newPassword);

      return res.json({
        success: true,
        data: { message: 'Password changed successfully' },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}

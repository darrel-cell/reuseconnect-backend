import { Response, NextFunction } from 'express';
import { DriverService } from '../services/driver.service';
import { AuthenticatedRequest, ApiResponse } from '../types';

const driverService = new DriverService();

export class DriverController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const drivers = await driverService.getDrivers(req.user.tenantId);

      // Transform drivers to include profile data
      const transformedDrivers = drivers.map(driver => ({
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        status: driver.status,
        vehicleReg: driver.driverProfile?.vehicleReg || 'N/A',
        vehicleType: driver.driverProfile?.vehicleType || 'van',
        vehicleFuelType: driver.driverProfile?.vehicleFuelType || 'diesel',
        hasProfile: !!driver.driverProfile,
      }));

      return res.json({
        success: true,
        data: transformedDrivers,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;

      // Drivers can only view their own record, admins can view any driver in their tenant
      if (req.user.role === 'driver' && id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Drivers can only view their own profile',
        } as ApiResponse);
      }

      const driver = await driverService.getDriverById(id);

      // If no profile exists yet, return empty strings so the UI shows empty fields
      const hasProfile =
        !!driver.driverProfile &&
        !!driver.driverProfile.vehicleReg &&
        driver.driverProfile.vehicleReg.trim().toUpperCase() !== 'TBD';

      return res.json({
        success: true,
        data: {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: hasProfile ? (driver.driverProfile?.phone || driver.phone || '') : '',
          status: driver.status,
          vehicleReg: hasProfile ? (driver.driverProfile?.vehicleReg || '') : '',
          vehicleType: hasProfile ? (driver.driverProfile?.vehicleType || 'van') : 'van',
          vehicleFuelType: hasProfile ? (driver.driverProfile?.vehicleFuelType || 'diesel') : 'diesel',
          hasProfile,
        },
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async createProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { userId, name, email, vehicleReg, vehicleType, vehicleFuelType, phone } = req.body;

      // Only admin can create profiles for other users
      // Drivers can create their own profile
      let profile;
      if (req.user.role === 'admin') {
        // Admin can create profiles with name/email or userId
        // Pass the admin's user ID so invitation can be created with correct inviter
        profile = await driverService.createOrUpdateProfile(req.user.tenantId, {
          userId,
          name,
          email,
          vehicleReg,
          vehicleType,
          vehicleFuelType,
          phone,
          invitedBy: req.user.userId, // Pass admin user ID for invitation creation
        });
      } else {
        // Drivers can only create their own profile
        profile = await driverService.createOrUpdateProfile(req.user.tenantId, {
          userId: req.user.userId,
          vehicleReg,
          vehicleType,
          vehicleFuelType,
          phone,
        });
      }

      return res.status(201).json({
        success: true,
        data: profile,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      const { name, email, vehicleReg, vehicleType, vehicleFuelType, phone } = req.body;

      // Only admin can update other users' profiles
      // Drivers can update their own profile
      const targetUserId = req.user.role === 'admin' ? id : req.user.userId;

      const profile = await driverService.updateProfile(targetUserId, {
        name,
        email,
        vehicleReg,
        vehicleType,
        vehicleFuelType,
        phone,
      });

      return res.json({
        success: true,
        data: profile,
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }

  async deleteProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
        } as ApiResponse);
      }

      const { id } = req.params;
      await driverService.deleteProfile(id);

      return res.json({
        success: true,
        message: 'Driver deleted successfully',
      } as ApiResponse);
    } catch (error) {
      return next(error);
    }
  }
}

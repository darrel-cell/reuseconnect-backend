// Type definitions matching frontend types
import { Request } from 'express';

export type UserRole = 'admin' | 'client' | 'reseller' | 'driver';
export type UserStatus = 'pending' | 'active' | 'inactive';

export type BookingStatus = 
  | 'pending'
  | 'created' 
  | 'scheduled' 
  | 'collected' 
  | 'sanitised' 
  | 'graded' 
  | 'completed' 
  | 'cancelled';

export type JobStatus = 
  | 'booked' 
  | 'routed' 
  | 'en_route' 
  | 'arrived' 
  | 'collected' 
  | 'warehouse' 
  | 'sanitised' 
  | 'graded' 
  | 'completed' 
  | 'cancelled';

export type CertificateType = 
  | 'chain_of_custody' 
  | 'data_wipe' 
  | 'destruction' 
  | 'recycling' 
  | 'esg_report';

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

// Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  fields?: Record<string, string>; // Field-specific validation errors
}

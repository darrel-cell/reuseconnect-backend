import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ValidationError } from '../utils/errors';

/**
 * Middleware to validate request using express-validator
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages: Record<string, string> = {};
      errors.array().forEach(error => {
        if ('path' in error) {
          errorMessages[error.path as string] = error.msg;
        }
      });
      return next(new ValidationError('Validation failed', errorMessages));
    }

    next();
  };
}


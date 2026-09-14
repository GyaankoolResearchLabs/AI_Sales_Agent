import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = 'Something went wrong. Please try again.';
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err && typeof err === 'object' && 'name' in err) {
    const anyErr = err as { name: string; message?: string; code?: number };
    if (anyErr.name === 'ValidationError') {
      statusCode = 400;
      message = anyErr.message || 'Validation failed';
    } else if (anyErr.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid identifier supplied';
    } else if (anyErr.code === 11000) {
      statusCode = 409;
      message = 'A record with this value already exists';
    } else if (anyErr.name === 'JsonWebTokenError' || anyErr.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Session expired, please log in again';
    }
  }

  if (statusCode >= 500) {
    logger.error(message, { error: err, path: req.originalUrl });
  } else {
    logger.warn(message, { path: req.originalUrl, statusCode });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      details,
      ...(env.nodeEnv !== 'production' && err instanceof Error ? { stack: err.stack } : {}),
    },
  });
}

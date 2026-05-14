// API error handling utilities

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export enum ApiErrorCode {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    public message: string,
    public statusCode: number,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiErrorResponse(error: unknown, defaultStatusCode = 500) {
  if (error instanceof ApiError) {
    logger.warn('API error', { error, context: error.context });
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        context: process.env.NODE_ENV === 'development' ? error.context : undefined,
      },
      { status: error.statusCode } as any
    );
  }

  if (error instanceof SyntaxError) {
    logger.warn('Syntax error in request', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  // Log unexpected errors
  logger.error('Unexpected API error', error, {
    type: error instanceof Error ? error.name : typeof error,
  });

  return NextResponse.json(
    {
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : String(error)
          : 'An unexpected error occurred',
    },
    { status: defaultStatusCode }
  );
}

export function createApiErrorResponse(
  code: ApiErrorCode,
  message: string,
  context?: Record<string, any>
): ApiError {
  const statusCodeMap: Record<ApiErrorCode, number> = {
    [ApiErrorCode.BAD_REQUEST]: 400,
    [ApiErrorCode.UNAUTHORIZED]: 401,
    [ApiErrorCode.FORBIDDEN]: 403,
    [ApiErrorCode.NOT_FOUND]: 404,
    [ApiErrorCode.CONFLICT]: 409,
    [ApiErrorCode.RATE_LIMITED]: 429,
    [ApiErrorCode.SERVER_ERROR]: 500,
    [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
    [ApiErrorCode.TIMEOUT]: 504,
  };

  return new ApiError(code, message, statusCodeMap[code], context);
}

// Wrapper for API route handlers with error handling
export function withErrorHandler<T extends Record<string, any>>(
  handler: (req: any, res?: any) => Promise<NextResponse<T>>
) {
  return async (req: any, res?: any) => {
    try {
      return await handler(req, res);
    } catch (error) {
      return apiErrorResponse(error);
    }
  };
}

// Wrapper for validating request bodies
export function validateRequestBody<T>(
  data: unknown,
  requiredFields: string[]
): T {
  if (!data || typeof data !== 'object') {
    throw createApiErrorResponse(
      ApiErrorCode.BAD_REQUEST,
      'Request body must be a valid JSON object'
    );
  }

  const body = data as Record<string, any>;
  const missing = requiredFields.filter((field) => !(field in body));

  if (missing.length > 0) {
    throw createApiErrorResponse(
      ApiErrorCode.BAD_REQUEST,
      `Missing required fields: ${missing.join(', ')}`,
      { missing }
    );
  }

  return body as T;
}

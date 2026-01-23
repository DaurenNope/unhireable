export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface UserFriendlyError {
  type: ErrorType;
  title: string;
  message: string;
  action?: string;
  retryable: boolean;
}

// Custom error classes
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ServerError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'ServerError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getUserFriendlyError(error: unknown): UserFriendlyError {
  // Handle network errors
  if (error instanceof NetworkError) {
    return {
      type: ErrorType.NETWORK_ERROR,
      title: 'Connection Problem',
      message: 'Unable to connect to the server. Please check your internet connection.',
      action: 'Retry',
      retryable: true,
    };
  }

  // Handle validation errors
  if (error instanceof ValidationError) {
    return {
      type: ErrorType.VALIDATION_ERROR,
      title: 'Invalid Input',
      message: error.message || 'Please check your input and try again.',
      retryable: false,
    };
  }

  // Handle permission errors
  if (error instanceof PermissionError) {
    return {
      type: ErrorType.PERMISSION_ERROR,
      title: 'Access Denied',
      message: error.message || 'You do not have permission to perform this action.',
      retryable: false,
    };
  }

  // Handle not found errors
  if (error instanceof NotFoundError) {
    return {
      type: ErrorType.NOT_FOUND_ERROR,
      title: 'Not Found',
      message: error.message || 'The requested resource was not found.',
      retryable: false,
    };
  }

  // Handle server errors
  if (error instanceof ServerError) {
    return {
      type: ErrorType.SERVER_ERROR,
      title: 'Server Error',
      message: error.message || 'An error occurred on the server. Please try again later.',
      action: 'Retry',
      retryable: true,
    };
  }

  // Handle timeout errors
  if (error instanceof TimeoutError) {
    return {
      type: ErrorType.NETWORK_ERROR,
      title: 'Request Timeout',
      message: error.message || 'The request took too long. Please try again.',
      action: 'Retry',
      retryable: true,
    };
  }

  // Handle API errors
  if (error instanceof ApiError) {
    if (error.status && error.status >= 500) {
      return {
        type: ErrorType.SERVER_ERROR,
        title: 'Server Error',
        message: error.message || 'An error occurred on the server. Please try again later.',
        action: 'Retry',
        retryable: true,
      };
    } else if (error.status === 404) {
      return {
        type: ErrorType.NOT_FOUND_ERROR,
        title: 'Not Found',
        message: error.message || 'The requested resource was not found.',
        retryable: false,
      };
    } else if (error.status === 401 || error.status === 403) {
      return {
        type: ErrorType.PERMISSION_ERROR,
        title: 'Access Denied',
        message: error.message || 'You do not have permission to perform this action.',
        retryable: false,
      };
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Check for network-related errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('failed to fetch')
    ) {
      return {
        type: ErrorType.NETWORK_ERROR,
        title: 'Connection Problem',
        message: 'Unable to connect to the server. Please check your internet connection.',
        action: 'Retry',
        retryable: true,
      };
    }

    // Check for validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return {
        type: ErrorType.VALIDATION_ERROR,
        title: 'Invalid Input',
        message: error.message || 'Please check your input and try again.',
        retryable: false,
      };
    }

    // Check for permission errors
    if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
      return {
        type: ErrorType.PERMISSION_ERROR,
        title: 'Access Denied',
        message: error.message || 'You do not have permission to perform this action.',
        retryable: false,
      };
    }

    // Check for not found errors
    if (message.includes('not found') || message.includes('404')) {
      return {
        type: ErrorType.NOT_FOUND_ERROR,
        title: 'Not Found',
        message: error.message || 'The requested resource was not found.',
        retryable: false,
      };
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      type: ErrorType.UNKNOWN_ERROR,
      title: 'Something Went Wrong',
      message: error,
      action: 'Retry',
      retryable: true,
    };
  }

  return {
    type: ErrorType.UNKNOWN_ERROR,
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again later.',
    action: 'Retry',
    retryable: true,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

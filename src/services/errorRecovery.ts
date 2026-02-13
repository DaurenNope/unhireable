import { log } from '../utils/logger';

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryCondition?: (error: Error) => boolean;
}

export interface ErrorRecoveryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

export class ErrorRecoveryService {
  private static defaultOptions: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryCondition: (error: Error) => {
      // Retry on network errors, timeouts, and temporary failures
      const retryableErrors = [
        'NETWORK_ERROR',
        'TIMEOUT',
        'CONNECTION_REFUSED',
        'TEMPORARY_FAILURE',
        'RATE_LIMITED',
      ];
      
      return retryableErrors.some(type => 
        error.message.includes(type) || 
        error.name.includes(type) ||
        (error as any).code === type
      );
    },
  };

  /**
   * Execute function with retry logic and exponential backoff
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<ErrorRecoveryResult<T>> {
    const opts = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let lastError: Error;
    let attempts = 0;

    log.info(`🔄 Starting operation with ${opts.maxRetries} max retries`);

    while (attempts <= opts.maxRetries) {
      attempts++;
      
      try {
        log.info(`📝 Attempt ${attempts}/${opts.maxRetries + 1}`);
        const result = await fn();
        
        const totalTime = Date.now() - startTime;
        log.info(`✅ Operation succeeded on attempt ${attempts} (${totalTime}ms)`);
        
        return {
          success: true,
          result,
          attempts,
          totalTime,
        };
      } catch (error) {
        lastError = error as Error;
        
        log.warn(`❌ Attempt ${attempts} failed: ${lastError.message}`);
        
        // Check if we should retry this error
        if (opts.retryCondition && !opts.retryCondition(lastError)) {
          log.error('🛑 Error is not retryable, stopping');
          break;
        }
        
        // If this was the last attempt, don't wait
        if (attempts > opts.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.initialDelay * Math.pow(opts.backoffMultiplier, attempts - 1),
          opts.maxDelay
        );
        
        log.info(`⏳ Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    const totalTime = Date.now() - startTime;
    log.error(`🚨 Operation failed after ${attempts} attempts (${totalTime}ms)`);
    
    return {
      success: false,
      error: lastError,
      attempts,
      totalTime,
    };
  }

  /**
   * Execute function with circuit breaker pattern
   */
  static async withCircuitBreaker<T>(
    fn: () => Promise<T>,
    threshold: number = 5,
    timeout: number = 60000
  ): Promise<ErrorRecoveryResult<T>> {
    const circuitBreaker = new CircuitBreaker(fn, threshold, timeout);
    
    try {
      const result = await circuitBreaker.execute();
      return {
        success: true,
        result,
        attempts: 1,
        totalTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        attempts: 1,
        totalTime: 0,
      };
    }
  }

  /**
   * Execute function with timeout
   */
  static async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<ErrorRecoveryResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        fn(),
        this.createTimeoutPromise(timeoutMs),
      ]);
      
      const totalTime = Date.now() - startTime;
      return {
        success: true,
        result,
        attempts: 1,
        totalTime,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      if (error instanceof TimeoutError) {
        log.error(`⏰ Operation timed out after ${timeoutMs}ms`);
      }
      
      return {
        success: false,
        error: error as Error,
        attempts: 1,
        totalTime,
      };
    }
  }

  /**
   * Execute function with fallback options
   */
  static async withFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFns: Array<() => Promise<T>>
  ): Promise<ErrorRecoveryResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    let lastError: Error;

    const functions = [primaryFn, ...fallbackFns];

    for (let i = 0; i < functions.length; i++) {
      attempts++;
      
      try {
        log.info(`🔄 Trying function ${i + 1}/${functions.length}`);
        const result = await functions[i]();
        
        const totalTime = Date.now() - startTime;
        log.info(`✅ Function ${i + 1} succeeded (${totalTime}ms)`);
        
        return {
          success: true,
          result,
          attempts,
          totalTime,
        };
      } catch (error) {
        lastError = error as Error;
        log.warn(`❌ Function ${i + 1} failed: ${lastError.message}`);
        
        if (i < functions.length - 1) {
          log.info(`🔄 Trying fallback function...`);
        }
      }
    }

    const totalTime = Date.now() - startTime;
    log.error(`🚨 All functions failed after ${attempts} attempts (${totalTime}ms)`);
    
    return {
      success: false,
      error: lastError,
      attempts,
      totalTime,
    };
  }

  /**
   * Sleep helper function
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create timeout promise
   */
  private static createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new TimeoutError(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker<T> {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;

  constructor(
    private fn: () => Promise<T>,
    private threshold: number,
    private timeout: number
  ) {}

  async execute(): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await this.fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      log.warn(`🚨 Circuit breaker opened after ${this.failureCount} failures`);
    }
  }
}

/**
 * Custom timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Browser automation error recovery utilities
 */
export class BrowserErrorRecovery {
  /**
   * Handle common browser automation errors with specific recovery strategies
   */
  static async handleBrowserError<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<ErrorRecoveryResult<T>> {
    return ErrorRecoveryService.withRetry(operation, {
      maxRetries: 3,
      initialDelay: 2000,
      maxDelay: 10000,
      retryCondition: (error: Error) => {
        const message = error.message.toLowerCase();
        
        // Retry on common browser issues
        const retryablePatterns = [
          'element not found',
          'element not visible',
          'element not clickable',
          'stale element reference',
          'timeout',
          'network error',
          'connection refused',
          'target closed',
          'session not found',
        ];
        
        const isRetryable = retryablePatterns.some(pattern => 
          message.includes(pattern)
        );
        
        if (isRetryable) {
          log.info(`🔄 Browser error in ${context} is retryable: ${error.message}`);
        } else {
          log.warn(`🛑 Browser error in ${context} is not retryable: ${error.message}`);
        }
        
        return isRetryable;
      },
    });
  }

  /**
   * Recover from page navigation issues
   */
  static async handleNavigationError(
    navigateFn: () => Promise<void>,
    fallbackUrl: string
  ): Promise<ErrorRecoveryResult<void>> {
    return ErrorRecoveryService.withFallback(
      navigateFn,
      [
        async () => {
          log.info('🔄 Trying direct navigation to fallback URL');
          // This would use your browser driver to navigate
          // await page.goto(fallbackUrl);
        },
        async () => {
          log.info('🔄 Trying page refresh');
          // await page.reload();
        },
      ]
    );
  }

  /**
   * Recover from element interaction issues
   */
  static async handleElementError<T>(
    elementAction: () => Promise<T>,
    fallbackSelectors: string[]
  ): Promise<ErrorRecoveryResult<T>> {
    return ErrorRecoveryService.withFallback(
      elementAction,
      fallbackSelectors.map((selector, index) => 
        async () => {
          log.info(`🔄 Trying fallback selector ${index + 1}: ${selector}`);
          // This would try the action with a different selector
          // const element = await page.$(selector);
          // return await elementAction(element);
          throw new Error('Not implemented');
        }
      )
    );
  }
}

// Export convenience functions
export const withRetry = ErrorRecoveryService.withRetry;
export const withCircuitBreaker = ErrorRecoveryService.withCircuitBreaker;
export const withTimeout = ErrorRecoveryService.withTimeout;
export const withFallback = ErrorRecoveryService.withFallback;
/**
 * Simple logger utility
 */
export const log = {
  info: (message: string, ...args: any[]) => {
    console.log(`ℹ️  [INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`⚠️  [WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`❌ [ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      console.log(`🐛 [DEBUG] ${message}`, ...args);
    }
  },
};
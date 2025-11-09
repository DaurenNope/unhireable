// Type definitions for @tauri-apps/api

declare module '@tauri-apps/api/tauri' {
  /**
   * Invoke a Tauri command
   */
  export function invoke<T = any>(cmd: string, args?: any): Promise<T>;
  
  // Add other Tauri API functions as needed
  // For example:
  // export function dialog: {
  //   open: (options?: any) => Promise<string | string[] | null>;
  //   save: (options?: any) => Promise<string | null>;
  //   // ... other dialog methods
  // };
  
  // Add other Tauri APIs (fs, shell, etc.) as needed
}

// Global Tauri API
declare interface Window {
  __TAURI__: {
    invoke: <T = any>(cmd: string, args?: any) => Promise<T>;
    // Add other Tauri window APIs as needed
  };
}

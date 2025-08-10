export const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, error?: Error, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
    if (error) console.error(error);
  }
};

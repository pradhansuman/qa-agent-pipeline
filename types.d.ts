// Minimal Node.js declarations for path module and __dirname global.
// Covers all usages in playwright.config.ts and tests/*.spec.ts.

declare const __dirname: string;
declare const __filename: string;

declare module 'path' {
  const path: {
    resolve(...pathSegments: string[]): string;
    join(...paths: string[]): string;
    dirname(p: string): string;
    basename(p: string, ext?: string): string;
  };
  export = path;
}

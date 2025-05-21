/**
 * Type definitions for lookml-parser
 */
declare module 'lookml-parser' {
  export function parseFiles(fileContents: Record<string, string>, options?: Record<string, any>): Promise<any>;
}
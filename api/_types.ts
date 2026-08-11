/**
 * Structural request/response types for the small surface used by our Vercel
 * functions. Keeping these local avoids pulling the full Vercel build toolchain
 * into the application dependency graph solely for two type aliases.
 */
export interface VercelRequest {
  headers: Record<string, string | string[] | undefined>;
}

export interface VercelResponse {
  status(statusCode: number): VercelResponse;
  json(body: unknown): VercelResponse;
}

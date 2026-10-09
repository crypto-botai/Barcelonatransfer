import type { ZodTypeAny, z } from "zod";
import { ApiError } from "./errors";
import type { ApiFieldProblem } from "./types";

/**
 * Request validation for /api/v1.
 *
 * Every body and query is parsed with a zod schema before a handler uses it. A
 * failure lists the fields that were wrong and why, never the values sent: a
 * rejected password or card number must not come back in a response or a log.
 */

function problems(error: z.ZodError): ApiFieldProblem[] {
  return error.issues.slice(0, 20).map((i) => ({ path: i.path.join(".") || "(body)", message: i.message }));
}

export function parseWith<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError("VALIDATION_FAILED", "Some details are missing or not valid.", { details: problems(result.error) });
  return result.data;
}

/** A JSON body, no larger than maxBytes. */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S, maxBytes = 64 * 1024): Promise<z.infer<S>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError("VALIDATION_FAILED", "The request is too large.");
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("VALIDATION_FAILED", "The request is not valid JSON.");
  }
  return parseWith(schema, json);
}

export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const params: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return parseWith(schema, params);
}

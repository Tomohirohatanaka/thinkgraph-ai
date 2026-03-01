/**
 * teachAI Input Validation & Sanitization
 * ─────────────────────────────────────────────────────────────
 * Centralized validation for all API inputs.
 * Prevents injection attacks, oversized payloads, and malformed data.
 */

export interface ValidationError {
  field: string;
  message: string;
  code: "REQUIRED" | "TYPE" | "RANGE" | "LENGTH" | "FORMAT" | "DANGEROUS";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  sanitized: Record<string, unknown>;
}

const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /data:text\/html/i,
  /vbscript:/i,
];

export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function hasDangerousContent(input: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(input));
}

export function sanitizeForLLM(input: string): string {
  // Remove null bytes and control characters (keep newlines/tabs)
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// Schema-based validator
type FieldType = "string" | "number" | "boolean" | "array" | "object";

interface FieldSchema {
  type: FieldType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  sanitize?: boolean;
  items?: FieldSchema;
  default?: unknown;
}

export function validate(
  data: Record<string, unknown>,
  schema: Record<string, FieldSchema>
): ValidationResult {
  const errors: ValidationError[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];

    if (value === undefined || value === null || value === "") {
      if (rule.required) {
        errors.push({ field, message: `${field} is required`, code: "REQUIRED" });
      } else if (rule.default !== undefined) {
        sanitized[field] = rule.default;
      }
      continue;
    }

    // Type checking
    if (rule.type === "string" && typeof value !== "string") {
      errors.push({ field, message: `${field} must be a string`, code: "TYPE" });
      continue;
    }
    if (rule.type === "number" && typeof value !== "number") {
      errors.push({ field, message: `${field} must be a number`, code: "TYPE" });
      continue;
    }
    if (rule.type === "boolean" && typeof value !== "boolean") {
      errors.push({ field, message: `${field} must be a boolean`, code: "TYPE" });
      continue;
    }
    if (rule.type === "array" && !Array.isArray(value)) {
      errors.push({ field, message: `${field} must be an array`, code: "TYPE" });
      continue;
    }

    // String validations
    if (typeof value === "string") {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push({ field, message: `${field} must be at least ${rule.minLength} characters`, code: "LENGTH" });
        continue;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rule.maxLength} characters`, code: "LENGTH" });
        continue;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({ field, message: `${field} has invalid format`, code: "FORMAT" });
        continue;
      }
      if (rule.sanitize !== false && hasDangerousContent(value)) {
        errors.push({ field, message: `${field} contains potentially dangerous content`, code: "DANGEROUS" });
        continue;
      }
      sanitized[field] = rule.sanitize === false ? value : sanitizeForLLM(value);
      continue;
    }

    // Number validations
    if (typeof value === "number") {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({ field, message: `${field} must be >= ${rule.min}`, code: "RANGE" });
        continue;
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({ field, message: `${field} must be <= ${rule.max}`, code: "RANGE" });
        continue;
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({ field, message: `${field} must have at most ${rule.maxLength} items`, code: "LENGTH" });
        continue;
      }
    }

    sanitized[field] = value;
  }

  return { valid: errors.length === 0, errors, sanitized };
}

// Pre-built validation schemas for common API inputs
export const SCHEMAS = {
  teach: {
    apiKey: { type: "string" as const, maxLength: 256, sanitize: false },
    topic: { type: "string" as const, required: true, minLength: 1, maxLength: 200 },
    coreText: { type: "string" as const, required: true, minLength: 1, maxLength: 50000 },
    mode: { type: "string" as const, required: true, pattern: /^(whynot|vocabulary|concept|procedure)$/ },
    userMessage: { type: "string" as const, required: true, minLength: 1, maxLength: 5000 },
    history: { type: "array" as const, maxLength: 20 },
    forceFinish: { type: "boolean" as const, default: false },
  },
  ingest: {
    apiKey: { type: "string" as const, maxLength: 256, sanitize: false },
    url: { type: "string" as const, maxLength: 2000 },
    text: { type: "string" as const, maxLength: 100000 },
  },
  score: {
    completeness: { type: "number" as const, required: true, min: 1, max: 5 },
    depth: { type: "number" as const, required: true, min: 1, max: 5 },
    clarity: { type: "number" as const, required: true, min: 1, max: 5 },
    structural_coherence: { type: "number" as const, required: true, min: 1, max: 5 },
    pedagogical_insight: { type: "number" as const, required: true, min: 1, max: 5 },
    mode: { type: "string" as const, pattern: /^(whynot|vocabulary|concept|procedure)$/, default: "concept" },
  },
} as const;

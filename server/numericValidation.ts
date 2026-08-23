/**
 * Backend Numeric Validation Utility Module
 * Enforces strict numeric constraints before Database writes, API processing, and State updates.
 *
 * Rejection guarantees:
 * - Rejects NaN, Infinity, -Infinity
 * - Rejects non-numeric strings ('abc', '10abc', '10.5.5', etc.)
 * - Rejects boolean/object/array injections
 * - Enforces integer-only for discrete counts/stocks/quantities (rejects decimals/fractions)
 * - Enforces non-negative / positive boundaries
 * - Provides clear, localized Arabic error messages without leaking internal server/db details
 */

export type BackendNumericType =
  | 'integer'              // Any finite integer (..., -2, -1, 0, 1, 2, ...)
  | 'non_negative_integer' // Integer >= 0 (0, 1, 2, 3...)
  | 'positive_integer'     // Integer >= 1 (1, 2, 3...)
  | 'decimal'              // Any finite decimal/float
  | 'non_negative_decimal' // Decimal >= 0
  | 'positive_decimal'     // Decimal > 0
  | 'percentage'           // Decimal between 0 and 100
  | 'rating';              // Integer between 1 and 5

export interface BackendValidationOptions {
  required?: boolean;
  min?: number;
  max?: number;
  fieldNameArabic?: string;
  allowNull?: boolean;
}

export interface BackendValidationResult {
  valid: boolean;
  isValid: boolean;
  value?: number;
  error?: string;
}

/**
 * Normalizes Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) into standard ASCII digits (0-9)
 */
export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

/**
 * Validates any raw value strictly against expected numeric rules.
 */
export function validateBackendNumeric(
  rawValue: any,
  type: BackendNumericType,
  options: BackendValidationOptions = {}
): BackendValidationResult {
  const {
    required = false,
    min,
    max,
    fieldNameArabic = 'القيمة المدخلة',
    allowNull = false
  } = options;

  // 1. Handle Empty / Undefined / Null values
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    if (allowNull && rawValue === null) {
      return { valid: true, isValid: true, value: undefined };
    }
    if (required) {
      return { valid: false, isValid: false, error: `${fieldNameArabic} حقل مطلوب ولا يمكن تركه فارغاً.` };
    }
    return { valid: true, isValid: true, value: undefined };
  }

  // 2. Reject boolean values, arrays, plain objects directly
  if (typeof rawValue === 'boolean' || typeof rawValue === 'object') {
    return { valid: false, isValid: false, error: `${fieldNameArabic} يجب أن تكون قيمة رقمية صحيحة وغير مركبة.` };
  }

  // 3. String normalization
  let str = normalizeDigits(String(rawValue)).trim();

  // 4. Strict Regex Formats
  const isIntegerType =
    type === 'integer' ||
    type === 'non_negative_integer' ||
    type === 'positive_integer' ||
    type === 'rating';

  const isNonNegative =
    type === 'non_negative_integer' ||
    type === 'positive_integer' ||
    type === 'non_negative_decimal' ||
    type === 'positive_decimal' ||
    type === 'percentage' ||
    type === 'rating';

  let regex: RegExp;
  if (type === 'non_negative_integer') {
    regex = /^(0|[1-9]\d*)$/;
  } else if (type === 'positive_integer') {
    regex = /^[1-9]\d*$/;
  } else if (type === 'integer') {
    regex = /^-?(0|[1-9]\d*)$/;
  } else if (type === 'rating') {
    regex = /^[1-5]$/;
  } else if (type === 'non_negative_decimal' || type === 'positive_decimal' || type === 'percentage') {
    regex = /^(0|[1-9]\d*)(\.\d+)?$/;
  } else {
    // general decimal
    regex = /^-?(0|[1-9]\d*)(\.\d+)?$/;
  }

  if (!regex.test(str)) {
    if (isIntegerType && /^-?\d+\.\d+$/.test(str)) {
      return { valid: false, isValid: false, error: `${fieldNameArabic} يجب أن تكون عدداً صحيحاً ولا تقبل الكسور العشرية.` };
    }
    return { valid: false, isValid: false, error: `${fieldNameArabic} غير صالحة. يرجى إدخال أرقام صحيحة فقط.` };
  }

  const num = Number(str);

  // 5. Check Finite & NaN
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} يجب أن تكون رقماً محدوداً وصالحاً.` };
  }

  // 6. Integer verification
  if (isIntegerType && !Number.isInteger(num)) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} يجب أن تكون عدداً صحيحاً بدون كسور.` };
  }

  // 7. Non-negative / Positive check
  if (isNonNegative && num < 0) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} لا يمكن أن تكون سالبة (أقل من الصفر).` };
  }

  if ((type === 'positive_integer' || type === 'positive_decimal') && num <= 0) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} يجب أن تكون أكبر من الصفر (> 0).` };
  }

  // 8. Percentage checks (0 to 100)
  if (type === 'percentage' && (num < 0 || num > 100)) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} يجب أن تكون نسبة مئوية بين 0 و 100.` };
  }

  // 9. Rating checks (1 to 5)
  if (type === 'rating' && (num < 1 || num > 5)) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} يجب أن يكون تقييماً بين 1 و 5 نجوم.` };
  }

  // 10. Explicit bounds checks
  if (min !== undefined && num < min) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} لا يمكن أن تقل عن ${min}.` };
  }

  if (max !== undefined && num > max) {
    return { valid: false, isValid: false, error: `${fieldNameArabic} لا يمكن أن تتجاوز ${max}.` };
  }

  return { valid: true, isValid: true, value: num };
}

/**
 * Express middleware or handler helper for quick validation and early 400 rejection.
 */
export function validateParamOrReject(
  res: any,
  value: any,
  type: BackendNumericType,
  options: BackendValidationOptions
): { valid: boolean; isValid: boolean; value?: number } {
  const result = validateBackendNumeric(value, type, options);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return { valid: false, isValid: false };
  }
  return { valid: true, isValid: true, value: result.value };
}

/**
 * Throws a clean Arabic Error if the value does not satisfy numeric constraints.
 * Ideal for DB model layers and business logic methods.
 */
export function assertNumeric(
  rawValue: any,
  type: BackendNumericType,
  options: BackendValidationOptions = {}
): number | undefined {
  const result = validateBackendNumeric(rawValue, type, options);
  if (!result.valid) {
    throw new Error(result.error || 'قيمة رقمية غير صالحة');
  }
  return result.value;
}


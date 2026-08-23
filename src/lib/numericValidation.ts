/**
 * Centralized Strict Numeric Input & Data Validation Library
 * Enforces strict numeric constraints across Frontend UI, Forms, and State.
 */
import type React from 'react';

export type NumericType =
  | 'integer'              // Any integer (..., -2, -1, 0, 1, 2, ...)
  | 'non_negative_integer' // Positive integers and zero (0, 1, 2, 10, 100...)
  | 'positive_integer'     // Positive integers only (1, 2, 3...)
  | 'decimal'              // Any finite decimal (..., -10.5, 0, 10.5, 99.99...)
  | 'non_negative_decimal' // Non-negative decimal numbers (0, 0.5, 10.5, 99.99...)
  | 'positive_decimal'     // Positive decimal numbers (> 0)
  | 'percentage';          // Percentage numbers (0 to 100)

export interface NumericValidationOptions {
  min?: number;
  max?: number;
  required?: boolean;
  allowEmpty?: boolean;
  fieldNameArabic?: string;
  maxDecimalPlaces?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  value?: number;
}

/**
 * Converts Eastern Arabic numerals (٠-٩) and Persian numerals (۰-۹) to standard Western digits (0-9)
 */
export function normalizeArabicDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9')
    .replace(/,/g, '.'); // Normalize Arabic/European decimal comma to dot
}

/**
 * Sanitizes input string strictly based on the target numeric type.
 * Strips all forbidden characters, signs, and excess dots.
 */
export function sanitizeNumericInput(rawValue: string, type: NumericType = 'non_negative_decimal'): string {
  if (rawValue === undefined || rawValue === null) return '';
  let str = normalizeArabicDigits(String(rawValue)).trim();

  const isInteger = type === 'integer' || type === 'non_negative_integer' || type === 'positive_integer';
  const isNonNegative = type === 'non_negative_integer' || type === 'positive_integer' || type === 'non_negative_decimal' || type === 'positive_decimal' || type === 'percentage';

  if (isInteger) {
    if (isNonNegative) {
      // Strip everything except 0-9
      return str.replace(/[^\d]/g, '');
    } else {
      // Allow single leading minus sign, then 0-9 only
      const hasMinus = str.startsWith('-');
      const digits = str.replace(/[^\d]/g, '');
      return (hasMinus ? '-' : '') + digits;
    }
  }

  // Decimal types
  if (isNonNegative) {
    // Strip everything except 0-9 and single dot
    str = str.replace(/[^\d.]/g, '');
    const parts = str.split('.');
    if (parts.length > 2) {
      // Keep only first dot
      str = parts[0] + '.' + parts.slice(1).join('');
    }
    return str;
  } else {
    // Allow leading minus, then digits and single dot
    const hasMinus = str.startsWith('-');
    str = str.replace(/[^\d.]/g, '');
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts[0] + '.' + parts.slice(1).join('');
    }
    return (hasMinus ? '-' : '') + str;
  }
}

/**
 * Tests whether a keyboard key press is valid for the target numeric type.
 */
export function handleNumericKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  type: NumericType = 'non_negative_decimal'
): void {
  // Always allow control/navigation keys
  const allowedKeys = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown'
  ];

  if (allowedKeys.includes(e.key)) {
    return;
  }

  // Allow standard keyboard shortcuts (Ctrl/Cmd + A, C, V, X, Z, Y)
  if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z', 'y', 'A', 'C', 'V', 'X', 'Z', 'Y'].includes(e.key)) {
    return;
  }

  const isInteger = type === 'integer' || type === 'non_negative_integer' || type === 'positive_integer';
  const isNonNegative = type === 'non_negative_integer' || type === 'positive_integer' || type === 'non_negative_decimal' || type === 'positive_decimal' || type === 'percentage';

  // Explicitly block 'e', 'E', '+', and scientific notation symbols
  if (['e', 'E', '+'].includes(e.key)) {
    e.preventDefault();
    return;
  }

  // Handle minus sign
  if (e.key === '-') {
    if (isNonNegative) {
      e.preventDefault();
      return;
    }
    // Only allow minus if at cursor index 0 and no minus exists
    const input = e.currentTarget;
    const start = input.selectionStart ?? 0;
    const value = input.value;
    if (start !== 0 || value.includes('-')) {
      e.preventDefault();
      return;
    }
    return;
  }

  // Handle decimal dot
  if (e.key === '.' || e.key === ',') {
    if (isInteger) {
      e.preventDefault();
      return;
    }
    const input = e.currentTarget;
    const value = input.value;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const selectedText = value.slice(start, end);

    // If there is already a dot in the unselected portion, block new dot
    const remainingValue = value.slice(0, start) + value.slice(end);
    if (remainingValue.includes('.')) {
      e.preventDefault();
      return;
    }
    return;
  }

  // Block any non-digit
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

/**
 * Tests whether a pasted string is completely valid for the target numeric type without any invalid characters.
 */
export function isValidNumericPaste(rawText: string, type: NumericType = 'non_negative_decimal'): boolean {
  if (!rawText || !rawText.trim()) return false;
  const str = normalizeArabicDigits(rawText).trim();

  let regex: RegExp;
  if (type === 'non_negative_integer') {
    regex = /^\d+$/;
  } else if (type === 'positive_integer') {
    regex = /^[1-9]\d*$/;
  } else if (type === 'integer') {
    regex = /^-?\d+$/;
  } else if (type === 'non_negative_decimal') {
    regex = /^\d+(\.\d+)?$/;
  } else if (type === 'positive_decimal') {
    regex = /^\d+(\.\d+)?$/;
    if (!regex.test(str)) return false;
    const n = Number(str);
    return !isNaN(n) && n > 0;
  } else if (type === 'percentage') {
    regex = /^\d+(\.\d+)?$/;
    if (!regex.test(str)) return false;
    const n = Number(str);
    return !isNaN(n) && n >= 0 && n <= 100;
  } else {
    regex = /^-?\d+(\.\d+)?$/;
  }

  return regex.test(str);
}

/**
 * Validates clipboard paste content. If it contains invalid characters, prevents the paste.
 */
export function handleNumericPaste(
  e: React.ClipboardEvent<HTMLInputElement>,
  type: NumericType = 'non_negative_decimal',
  onSanitizedChange?: (value: string) => void
): void {
  const clipboardData = e.clipboardData.getData('text');
  if (!clipboardData) return;

  if (!isValidNumericPaste(clipboardData, type)) {
    // Explicitly prevent pasting invalid values like "-500", "abc", "100abc", "10.5.5"
    e.preventDefault();
    return;
  }

  const normalized = normalizeArabicDigits(clipboardData).trim();
  if (onSanitizedChange) {
    e.preventDefault();
    onSanitizedChange(normalized);
  }
}

/**
 * Strict Form Validator: Validates numeric value before Submit or on field blur.
 * Checks for NaN, Infinity, -Infinity, integer constraints, min/max, non-negative, and decimal places.
 */
export function validateNumericValue(
  rawVal: any,
  type: NumericType = 'non_negative_decimal',
  options: NumericValidationOptions = {}
): ValidationResult {
  const {
    min,
    max,
    required = false,
    allowEmpty = true,
    fieldNameArabic = 'القيمة',
    maxDecimalPlaces
  } = options;

  // Handle empty cases
  if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
    if (required) {
      return { valid: false, error: `${fieldNameArabic} مطلوبة ولا يمكن أن تكون فارغة.` };
    }
    if (allowEmpty) {
      return { valid: true, value: undefined };
    }
    return { valid: false, error: `يرجى إدخال قيمة رقمية صحيحة لـ ${fieldNameArabic}.` };
  }

  const strVal = normalizeArabicDigits(String(rawVal)).trim();

  // Test regex format according to type
  const isInteger = type === 'integer' || type === 'non_negative_integer' || type === 'positive_integer';
  const isNonNegative = type === 'non_negative_integer' || type === 'positive_integer' || type === 'non_negative_decimal' || type === 'positive_decimal' || type === 'percentage';

  let regex: RegExp;
  if (type === 'non_negative_integer') {
    regex = /^\d+$/;
  } else if (type === 'positive_integer') {
    regex = /^[1-9]\d*$/;
  } else if (type === 'integer') {
    regex = /^-?\d+$/;
  } else if (type === 'non_negative_decimal' || type === 'positive_decimal' || type === 'percentage') {
    regex = /^\d+(\.\d+)?$/;
  } else {
    regex = /^-?\d+(\.\d+)?$/;
  }

  if (!regex.test(strVal)) {
    if (isInteger && strVal.includes('.')) {
      return { valid: false, error: `${fieldNameArabic} يجب أن تكون رقماً صحيحاً بدون كسور عشرية.` };
    }
    if (isNonNegative && strVal.startsWith('-')) {
      return { valid: false, error: `${fieldNameArabic} لا يمكن أن تكون قيمة سالبة (يجب أن تكون 0 أو أكبر).` };
    }
    return { valid: false, error: `${fieldNameArabic} تحتوي على حروف أو رموز غير صالحة. يرجى إدخال أرقام فقط.` };
  }

  const num = Number(strVal);

  // Safety checks against NaN and Infinity
  if (typeof num !== 'number' || isNaN(num) || !Number.isFinite(num) || Math.abs(num) === Infinity) {
    return { valid: false, error: `${fieldNameArabic} قيمة رقمية غير صالحة.` };
  }

  // Integer verification
  if (isInteger && !Number.isInteger(num)) {
    return { valid: false, error: `${fieldNameArabic} يجب أن تكون رقماً صحيحاً.` };
  }

  // Non-negative verification
  if (isNonNegative && num < 0) {
    return { valid: false, error: `${fieldNameArabic} لا يمكن أن تكون سالبة.` };
  }

  // Positive verification
  if ((type === 'positive_integer' || type === 'positive_decimal') && num <= 0) {
    return { valid: false, error: `${fieldNameArabic} يجب أن تكون أكبر من الصفر (> 0).` };
  }

  // Percentage verification
  if (type === 'percentage' && (num < 0 || num > 100)) {
    return { valid: false, error: `${fieldNameArabic} يجب أن تكون بين 0% و 100%.` };
  }

  // Min check
  if (min !== undefined && num < min) {
    return { valid: false, error: `${fieldNameArabic} لا يمكن أن تقل عن ${min}.` };
  }

  // Max check
  if (max !== undefined && num > max) {
    return { valid: false, error: `${fieldNameArabic} لا يمكن أن تتجاوز ${max}.` };
  }

  // Decimal places check
  if (maxDecimalPlaces !== undefined && strVal.includes('.')) {
    const decimals = strVal.split('.')[1] || '';
    if (decimals.length > maxDecimalPlaces) {
      return { valid: false, error: `${fieldNameArabic} لا يمكن أن تحتوي على أكثر من ${maxDecimalPlaces} منازل عشرية.` };
    }
  }

  return { valid: true, value: num };
}

/**
 * Safely parses an input to a valid number. Returns fallback if invalid.
 */
export function parseStrictNumber(val: any, fallback: number = 0, type: NumericType = 'non_negative_decimal'): number {
  const res = validateNumericValue(val, type, { allowEmpty: false });
  return res.valid && res.value !== undefined ? res.value : fallback;
}

/**
 * Safely parses an input to a valid integer. Returns fallback if invalid.
 */
export function parseStrictInteger(val: any, fallback: number = 0, type: NumericType = 'non_negative_integer'): number {
  const res = validateNumericValue(val, type, { allowEmpty: false });
  return res.valid && res.value !== undefined ? Math.floor(res.value) : fallback;
}

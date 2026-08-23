/**
 * Centralized User-Friendly Error Handler and Message Mapper.
 * 
 * Guarantees that no raw JavaScript exceptions, Axios/Fetch internals, stack traces,
 * or technical server error dumps are ever presented to end users.
 * 
 * Maps HTTP status codes, network states, and technical errors into clean, friendly Arabic messages,
 * while preserving valid user-facing Arabic validation messages returned by backend APIs.
 */

export class ApiError extends Error {
  public status: number;
  public data?: any;
  public isApiError = true;

  constructor(message: string, status: number = 500, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Check if string contains Arabic characters
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

// Known technical terms/patterns that must NEVER be shown to users
const TECHNICAL_PATTERNS = [
  /is not a function/i,
  /cannot read propert/i,
  /cannot set propert/i,
  /unexpected token/i,
  /undefined/i,
  /null/i,
  /axioserror/i,
  /typeerror/i,
  /referenceerror/i,
  /syntaxerror/i,
  /rangeerror/i,
  /evalerror/i,
  /networkerror/i,
  /failed to fetch/i,
  /fetch failed/i,
  /network error/i,
  /load failed/i,
  /net::err/i,
  /econnrefused/i,
  /etimedout/i,
  /socket hang up/i,
  /\[object\s+Object\]/i,
  /\[object\s+Error\]/i,
  /chunkloaderror/i,
  /dynamically imported module/i,
  /internal server error/i,
  /at\s+[\w$./\\-]+\s+\(/i, // Stack trace lines
  /\.tsx?:\d+:\d+/i,        // Source map coordinates
  /\.jsx?:\d+:\d+/i,
  /http:\/\//i,
  /https:\/\//i,
  /api request failed with status/i
];

/**
 * Standard Status Code Mappings to Friendly Arabic
 */
const STATUS_CODE_MESSAGES: Record<number, string> = {
  400: 'البيانات غير صحيحة.',
  401: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
  403: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  404: 'العنصر غير موجود.',
  409: 'البيانات موجودة بالفعل.',
  422: 'يرجى مراجعة البيانات المدخلة.',
  429: 'تم تنفيذ عدد كبير من الطلبات، حاول بعد قليل.',
  500: 'حدث خطأ داخلي بالخادم.',
  502: 'حدث خطأ داخلي بالخادم.',
  503: 'الخدمة غير متوفرة حالياً، يرجى المحاولة بعد قليل.',
  504: 'انتهت مهلة الاتصال بالخادم.'
};

/**
 * Extract status code from various error shapes (ApiError, fetch Response, Axios, custom objects)
 */
function extractStatusCode(error: any): number | null {
  if (!error) return null;
  if (typeof error.status === 'number' && error.status >= 100 && error.status < 600) return error.status;
  if (typeof error.statusCode === 'number' && error.statusCode >= 100 && error.statusCode < 600) return error.statusCode;
  if (typeof error.response?.status === 'number') return error.response.status;
  if (typeof error.code === 'number' && error.code >= 100 && error.code < 600) return error.code;
  
  // Try extracting from string like "status 404" or "code 401"
  if (typeof error.message === 'string') {
    const match = error.message.match(/status\s+(\d{3})/i) || error.message.match(/\b(4\d\d|5\d\d)\b/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && STATUS_CODE_MESSAGES[parsed]) {
        return parsed;
      }
    }
  }
  return null;
}

/**
 * Clean error message by removing prefix noise (e.g. "Error: ", "Uncaught (in promise) ")
 */
function sanitizeMessageString(msg: string): string {
  let cleaned = msg.trim();
  cleaned = cleaned.replace(/^Error:\s*/i, '');
  cleaned = cleaned.replace(/^Uncaught\s+(\(in promise\)\s+)?Error:\s*/i, '');
  cleaned = cleaned.replace(/^API request failed with status \d+:\s*/i, '');
  return cleaned.trim();
}

/**
 * Checks if a string contains technical or unsafe raw exception patterns
 */
function containsTechnicalPatterns(text: string): boolean {
  if (!text) return false;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Primary Reusable Function:
 * Returns a friendly, safe Arabic error message for any error thrown across the application.
 * Logs the raw error strictly to console for developers.
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallbackMessage?: string
): string {
  // 1. Log raw error only to browser console for developer inspection
  if (typeof console !== 'undefined' && console.error) {
    console.error('[AppError Developer Trace]:', error);
  }

  // 2. Handle nullish inputs
  if (error === null || error === undefined || error === '') {
    return fallbackMessage || 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.';
  }

  // 3. Handle string errors directly
  if (typeof error === 'string') {
    const cleaned = sanitizeMessageString(error);
    if (!containsTechnicalPatterns(cleaned) && ARABIC_REGEX.test(cleaned)) {
      return cleaned;
    }
    // Check if network error or timeout in string
    if (/network error|failed to fetch|fetch failed|load failed/i.test(cleaned)) {
      return 'تعذر الاتصال بالخادم.';
    }
    if (/timeout|timed out|abort/i.test(cleaned)) {
      return 'انتهت مهلة الاتصال.';
    }
  }

  const errObj = error as any;

  // 4. Check for Network / Timeout specific error classes and types
  const errorName = errObj?.name || '';
  const errorMessage = typeof errObj?.message === 'string' ? errObj.message : '';
  const cleanedMessage = sanitizeMessageString(errorMessage);

  if (
    errorName === 'AbortError' ||
    errorName === 'TimeoutError' ||
    /timeout|timed out|abort/i.test(errorMessage)
  ) {
    return 'انتهت مهلة الاتصال.';
  }

  if (
    errorName === 'TypeError' &&
    /failed to fetch|fetch failed|network|load failed/i.test(errorMessage)
  ) {
    return 'تعذر الاتصال بالخادم.';
  }

  if (/network error|failed to fetch|fetch failed|econnrefused|net::err/i.test(errorMessage)) {
    return 'تعذر الاتصال بالخادم.';
  }

  // 5. Check if server returned a valid, intentional Arabic message (e.g. backend validation)
  // Check in error.data?.error, error.error, error.message
  const candidateMessages = [
    errObj?.data?.error,
    errObj?.data?.message,
    errObj?.response?.data?.error,
    errObj?.response?.data?.message,
    errObj?.error,
    cleanedMessage
  ];

  for (const cand of candidateMessages) {
    if (typeof cand === 'string') {
      const sanitized = sanitizeMessageString(cand);
      if (sanitized && ARABIC_REGEX.test(sanitized) && !containsTechnicalPatterns(sanitized)) {
        return sanitized;
      }
    }
  }

  // 6. Check HTTP Status Code mapping
  const statusCode = extractStatusCode(errObj);
  if (statusCode && STATUS_CODE_MESSAGES[statusCode]) {
    return STATUS_CODE_MESSAGES[statusCode];
  }

  // 7. Check if fallback message is valid Arabic
  if (fallbackMessage && ARABIC_REGEX.test(fallbackMessage) && !containsTechnicalPatterns(fallbackMessage)) {
    return fallbackMessage;
  }

  // 8. Default friendly fallback for any unknown JS exception or unhandled error
  return 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.';
}

export default getFriendlyErrorMessage;

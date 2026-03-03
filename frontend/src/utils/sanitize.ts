// Frontend sanitization utilities for XSS prevention

/**
 * Sanitizes HTML content to prevent XSS attacks
 * In production, consider using DOMPurify library
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Remove script tags and event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe/gi, '&lt;iframe')
    .replace(/onerror/gi, '')
    .replace(/onload/gi, '');
}

/**
 * Sanitizes plain text to prevent XSS
 */
export function sanitizeText(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')  // must be first to avoid double-escaping
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates URL to prevent javascript: and data: protocols
 */
export function validateUrl(url: string): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    return allowedProtocols.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Sanitizes URL
 */
export function sanitizeUrl(url: string): string {
  if (!validateUrl(url)) {
    return '#';
  }
  return url;
}

/**
 * Removes sensitive data from strings before logging
 */
export function sanitizeForLogging(data: string): string {
  if (!data) return '';

  // Redact API keys, tokens, passwords
  return data
    .replace(/(api[_-]?key|apikey|token|secret|password)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi, '$1: ***REDACTED***')
    .replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***REDACTED***')
    .replace(/pk_[a-zA-Z0-9]{32,}/g, 'pk_***REDACTED***');
}









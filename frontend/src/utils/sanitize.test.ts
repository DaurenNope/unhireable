import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  sanitizeText,
  validateUrl,
  sanitizeUrl,
  sanitizeForLogging,
} from './sanitize';

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    const result = sanitizeHtml('<script>alert("xss")</script>Hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  it('removes inline event handlers', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
  });

  it('removes javascript: protocol', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('escapes iframe tags', () => {
    const result = sanitizeHtml('<iframe src="evil.com"></iframe>');
    expect(result).toContain('&lt;iframe');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('sanitizeText', () => {
  it('escapes angle brackets', () => {
    expect(sanitizeText('<script>')).toContain('&lt;');
    expect(sanitizeText('<script>')).toContain('&gt;');
  });

  it('escapes quotes', () => {
    expect(sanitizeText('"hello"')).toContain('&quot;');
    expect(sanitizeText("it's")).toContain('&#x27;');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeText('')).toBe('');
  });
});

describe('validateUrl', () => {
  it('accepts https URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true);
  });

  it('accepts http URLs', () => {
    expect(validateUrl('http://example.com')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(validateUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(validateUrl('data:text/html,<h1>xss</h1>')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(validateUrl('not a url')).toBe(false);
  });
});

describe('sanitizeUrl', () => {
  it('returns the URL for valid https links', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('returns # for javascript: URLs', () => {
    expect(sanitizeUrl('javascript:evil()')).toBe('#');
  });

  it('returns # for empty string', () => {
    expect(sanitizeUrl('')).toBe('#');
  });
});

describe('sanitizeForLogging', () => {
  it('redacts OpenAI sk- keys', () => {
    const result = sanitizeForLogging('key=sk-aBcDeFgHiJkLmNoPqRsTuVwXyZaB1234');
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('sk-aBcDeFgHiJkL');
  });

  it('redacts api_key fields', () => {
    const result = sanitizeForLogging('api_key: "my-secret-key-longer-than-twenty-chars"');
    expect(result).toContain('***REDACTED***');
  });

  it('leaves normal text unchanged', () => {
    const input = 'hello world, status: active';
    expect(sanitizeForLogging(input)).toBe(input);
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeForLogging('')).toBe('');
  });
});

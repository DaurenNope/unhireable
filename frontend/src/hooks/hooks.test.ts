import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnline } from './use-online';
import { useRetry } from './use-retry';

// ---------------------------------------------------------------------------
// useOnline
// ---------------------------------------------------------------------------
describe('useOnline', () => {
  it('returns true when navigator.onLine is true', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
  });

  it('updates to false when "offline" event fires', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    const { result } = renderHook(() => useOnline());
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
  });

  it('updates to true when "online" event fires after going offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const { result } = renderHook(() => useOnline());
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnline());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// useRetry
// ---------------------------------------------------------------------------
describe('useRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls fn and returns result on success', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    const { result } = renderHook(() => useRetry(fn, 3));

    let value: string | undefined;
    await act(async () => {
      value = await result.current.execute();
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(value).toBe('done');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading to true while executing', async () => {
    let resolve!: (v: string) => void;
    const fn = vi.fn().mockReturnValue(new Promise<string>(r => { resolve = r; }));
    const { result } = renderHook(() => useRetry(fn, 0));

    act(() => { result.current.execute(); });
    expect(result.current.loading).toBe(true);

    await act(async () => { resolve('ok'); });
    expect(result.current.loading).toBe(false);
  });

  it('sets error and stops after maxRetries exhausted', async () => {
    const err = new Error('fail');
    const fn = vi.fn().mockRejectedValue(err);
    const { result } = renderHook(() => useRetry(fn, 0));

    await act(async () => {
      try {
        await result.current.execute();
      } catch (_) {
        // expected to throw
      }
    });

    expect(result.current.error).toBe(err);
    expect(result.current.loading).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AnimatedCounter } from './animated-counter';

vi.mock('framer-motion', () => ({
  useInView: () => true,
}));

describe('AnimatedCounter', () => {
  let originalRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    originalRaf = global.requestAnimationFrame;
    // tie requestAnimationFrame to setTimeout so fake timers control it
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    global.requestAnimationFrame = originalRaf;
  });

  it('animates to the final value', async () => {
    render(<AnimatedCounter value="42" duration={0.1} />);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(screen.getByText('42')).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../utils/retry';

describe('withRetry', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return value on first successful attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry and return value when function fails then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { baseDelayMs: 1 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw last error when all retries are exhausted', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))
      .mockRejectedValueOnce(new Error('fail 4'));

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('fail 4');

    expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should use exponential backoff for delays', async () => {
    vi.useFakeTimers();

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'))
      .mockResolvedValue('success');

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });

    // Initial call happens immediately
    expect(fn).toHaveBeenCalledTimes(1);

    // First retry delay: 100ms * 2^0 = 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Second retry delay: 100ms * 2^1 = 200ms
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    // Third retry delay: 100ms * 2^2 = 400ms
    await vi.advanceTimersByTimeAsync(400);
    expect(fn).toHaveBeenCalledTimes(4);

    const result = await promise;
    expect(result).toBe('success');

    vi.useRealTimers();
  });

  it('should use default maxRetries of 3', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('final fail'));

    await expect(
      withRetry(fn, { baseDelayMs: 1 }),
    ).rejects.toThrow('final fail');

    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('should convert non-Error throws to Error objects', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce('string error')
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { baseDelayMs: 1 });

    expect(result).toBe('ok');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('string error'),
    );
  });

  it('should log warnings with context on each failed attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('oops'))
      .mockResolvedValue('ok');

    await withRetry(fn, { baseDelayMs: 1, context: 'TestOp' });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[TestOp]'),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Attempt 1/'),
    );
  });

  it('should not delay or log when succeeding on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('instant');

    const result = await withRetry(fn, { baseDelayMs: 1000 });

    expect(result).toBe('instant');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should work with maxRetries set to 0 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('fail'));

    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 1 }),
    ).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should not log warning on the final failed attempt', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('only fail'));

    await expect(
      withRetry(fn, { maxRetries: 0, baseDelayMs: 1 }),
    ).rejects.toThrow('only fail');

    // With maxRetries=0, there is 1 attempt and no retries, so no warning
    expect(console.warn).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { flushDeferredSave, hasPendingDeferredSave } from "../src/deferred-save";

describe("deferred save", () => {
  it("clears the pending timer and saves immediately before closing", async () => {
    const state = { timer: 12 };
    const clearTimer = vi.fn();
    const save = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await flushDeferredSave(state, clearTimer, save);

    expect(clearTimer).toHaveBeenCalledWith(12);
    expect(save).toHaveBeenCalledOnce();
    expect(hasPendingDeferredSave(state)).toBe(false);
  });

  it("does not save when no save timer is pending", async () => {
    const state = { timer: null };
    const clearTimer = vi.fn();
    const save = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await flushDeferredSave(state, clearTimer, save);

    expect(clearTimer).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});

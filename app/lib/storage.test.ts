import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPersistenceStatus,
  requestPersistentStorage,
} from "@/app/lib/storage";

function stubStorage(
  storage: Partial<StorageManager> | undefined,
): void {
  vi.stubGlobal("navigator", storage === undefined ? {} : { storage });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getPersistenceStatus", () => {
  it("reports unsupported when the API is missing", async () => {
    stubStorage(undefined);
    await expect(getPersistenceStatus()).resolves.toBe("unsupported");
  });

  it("reads the current state without prompting", async () => {
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });

    await expect(getPersistenceStatus()).resolves.toBe("granted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not throw when persisted() rejects", async () => {
    stubStorage({ persisted: vi.fn().mockRejectedValue(new Error("nope")) });
    await expect(getPersistenceStatus()).resolves.toBe("unsupported");
  });
});

describe("requestPersistentStorage", () => {
  it("is a no-op when the API is missing", async () => {
    stubStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });

  it("skips the prompt when storage is already persistent", async () => {
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });

    await expect(requestPersistentStorage()).resolves.toBe("granted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("requests persistence and reports a grant", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });

    await expect(requestPersistentStorage()).resolves.toBe("granted");
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("reports a denial instead of throwing", async () => {
    stubStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    });

    await expect(requestPersistentStorage()).resolves.toBe("denied");
  });

  it("treats a rejected persist() as denied", async () => {
    stubStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockRejectedValue(new Error("blocked")),
    });

    await expect(requestPersistentStorage()).resolves.toBe("denied");
  });
});

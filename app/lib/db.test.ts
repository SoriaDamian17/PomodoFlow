import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F014 persistence coverage for app/lib/db.ts: the idb open call is mocked so
 * the in-place upgrade() and the availability probe are verifiable without a
 * browser IndexedDB implementation.
 */

vi.mock("idb", () => ({ openDB: vi.fn() }));

const { openDB } = await import("idb");

const mockOpenDB = vi.mocked(openDB);

interface UpgradeTarget {
  createObjectStore: ReturnType<typeof vi.fn>;
  objectStoreNames: string[];
}

function makeUpgradeTarget(): UpgradeTarget {
  const stores: string[] = [];
  return {
    objectStoreNames: stores,
    createObjectStore: vi.fn((name: string) => {
      stores.push(name);
      return {
        createIndex: vi.fn(),
      };
    }),
  };
}

/** Re-imports db.ts so the module-level dbInstance cache starts clean. */
async function freshDbModule() {
  vi.resetModules();
  const mod = await import("@/app/lib/db");
  const idb = await import("idb");
  return { mod, openDB: vi.mocked(idb.openDB) };
}

/**
 * Extracts and runs the upgrade callback captured by the openDB mock,
 * returning the fake database so store creation can be asserted.
 */
function runUpgrade(
  options: unknown,
  oldVersion: number,
  newVersion: number,
): UpgradeTarget {
  const upgrade = (options as { upgrade?: (...args: unknown[]) => void } | undefined)
    ?.upgrade;
  if (typeof upgrade !== "function") {
    throw new Error("openDB was called without an upgrade callback");
  }

  const target = makeUpgradeTarget();
  upgrade(
    target as never,
    oldVersion,
    newVersion,
    undefined as never,
    undefined as never,
  );
  return target;
}

beforeEach(() => {
  vi.resetModules();
  mockOpenDB.mockReset();
});

describe("getDB upgrade (F012 in-place schema bump)", () => {
  it("creates todos, sessions and tasks stores when upgrading from scratch", async () => {
    const { mod, openDB } = await freshDbModule();
    openDB.mockResolvedValue({} as never);

    await mod.getDB();

    expect(openDB).toHaveBeenCalledTimes(1);
    const [name, version, options] = openDB.mock.calls[0];
    expect(name).toBe("pomodoro-db");
    expect(version).toBe(3);

    const target = runUpgrade(options, 0, 0);

    expect(target.objectStoreNames).toEqual(["todos", "sessions", "tasks"]);
  });

  it("only adds the stores missing from the installed version", async () => {
    const { mod, openDB } = await freshDbModule();
    openDB.mockResolvedValue({} as never);

    await mod.getDB();
    const options = openDB.mock.calls[0][2];

    // v2 database: todos + sessions already exist, tasks must be added in
    // place without touching the existing stores.
    const target = runUpgrade(options, 2, 2);

    expect(target.objectStoreNames).toEqual(["tasks"]);
  });

  it("is a no-op for a database already at the current version", async () => {
    const { mod, openDB } = await freshDbModule();
    openDB.mockResolvedValue({} as never);

    await mod.getDB();
    const options = openDB.mock.calls[0][2];

    const target = runUpgrade(options, 3, 3);

    expect(target.objectStoreNames).toEqual([]);
  });

  it("returns the same instance on subsequent calls", async () => {
    const { mod, openDB } = await freshDbModule();
    const instance = {} as never;
    openDB.mockResolvedValue(instance);

    const first = await mod.getDB();
    const second = await mod.getDB();

    expect(first).toBe(second);
    expect(openDB).toHaveBeenCalledTimes(1);
  });
});

describe("isDatabaseAvailable (F012 fallback)", () => {
  it("resolves true when the database opens", async () => {
    const { mod, openDB } = await freshDbModule();
    openDB.mockResolvedValue({} as never);

    expect(await mod.isDatabaseAvailable()).toBe(true);
  });

  it("resolves false when IndexedDB is unavailable (private mode/quota)", async () => {
    const { mod, openDB } = await freshDbModule();
    openDB.mockRejectedValue(new Error("SecurityError: blocked"));

    expect(await mod.isDatabaseAvailable()).toBe(false);
  });

  it("stays false on a later call after the first failure", async () => {
    const { mod, openDB } = await freshDbModule();
    openDB.mockRejectedValue(new Error("SecurityError"));

    expect(await mod.isDatabaseAvailable()).toBe(false);
    expect(await mod.isDatabaseAvailable()).toBe(false);
  });
});

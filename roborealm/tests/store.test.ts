import { beforeAll, describe, expect, it } from "vitest";

// Minimal localStorage so the persisted store runs under Node.
const mem = new Map<string, string>();
beforeAll(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
});

describe("saved progress", () => {

  it("rejects invalid robot designs", async () => {
    const { useGame } = await import("@/progress/store");
    const { starterDesign } = await import("@/robots/design");
    expect(() => useGame.getState().saveDesign({ ...starterDesign("bad"), battery: "" })).toThrow(/battery/);
  });

  it("round-trips through storage", async () => {
    const { useGame, SAVE_KEY } = await import("@/progress/store");
    const { starterDesign } = await import("@/robots/design");
    useGame.getState().saveDesign(starterDesign("robot-9", "Nine"));
    useGame.getState().saveDraft("m3-coordinate-courier", { editor: "python", python: "print(1)" });
    const saved = mem.get(SAVE_KEY)!;
    useGame.setState({ garage: [], drafts: {} }, false);
    mem.set(SAVE_KEY, saved);
    await useGame.persist.rehydrate();
    const r = useGame.getState();
    expect(r.garage.map((g) => g.id)).toContain("robot-9");
    expect(r.drafts["m3-coordinate-courier"].python).toBe("print(1)");
  });

  it("ignores save files from an unknown version", async () => {
    const { useGame, SAVE_KEY } = await import("@/progress/store");
    mem.set(SAVE_KEY, JSON.stringify({ state: { version: 99, game: { xp: 1e9 } }, version: 1 }));
    await useGame.persist.rehydrate();
    expect(useGame.getState().game.xp).toBeLessThan(1e9);
  });
});

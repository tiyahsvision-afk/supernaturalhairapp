import { describe, expect, it } from "vitest";
import { deriveSpec, designStats, meetsRequirements, starterDesign, validateDesign } from "@/robots/design";

describe("robot workshop designs", () => {
  it("the starter design is valid", () => {
    expect(validateDesign(starterDesign()).ok).toBe(true);
  });

  it("requires the essential parts", () => {
    const d = { ...starterDesign(), battery: "", controller: "" };
    const c = validateDesign(d);
    expect(c.ok).toBe(false);
    expect(c.errors.join(" ")).toMatch(/battery/);
    expect(c.errors.join(" ")).toMatch(/controller/);
  });

  it("controller ports limit sensors", () => {
    const d = {
      ...starterDesign(),
      controller: "brain-1",
      sensors: [
        { part: "ultrasonic", mount: "front" as const },
        { part: "ultrasonic", mount: "left" as const },
        { part: "ultrasonic", mount: "right" as const },
      ],
    };
    expect(validateDesign(d).errors.join(" ")).toMatch(/sensor ports/);
  });

  it("gripper needs a chassis with a mount", () => {
    expect(validateDesign({ ...starterDesign(), chassis: "scout" }).ok).toBe(false);
  });

  it("components change capabilities", () => {
    const base = deriveSpec(starterDesign());
    const fast = deriveSpec({ ...starterDesign(), motor: "dc-turbo" });
    const bigBattery = deriveSpec({ ...starterDesign(), battery: "lipo-l" });
    const large = deriveSpec({ ...starterDesign(), drive: "wheels-large" });
    expect(fast.maxWheelSpeed).toBeGreaterThan(base.maxWheelSpeed);
    expect(fast.motorW).toBeGreaterThan(base.motorW);
    expect(bigBattery.batteryWh).toBeGreaterThan(base.batteryWh);
    expect(large.maxWheelSpeed).toBeGreaterThan(base.maxWheelSpeed);
    expect(designStats({ ...starterDesign(), battery: "lipo-l" }).runtimeMin).toBeGreaterThan(designStats(starterDesign()).runtimeMin);
  });

  it("sensor mounts become named sensors; missing ones are reported", () => {
    const d = { ...starterDesign(), sensors: [{ part: "lidar-point", mount: "left" as const }], gripper: null };
    const spec = deriveSpec(d);
    expect(spec.sensors[0]).toMatchObject({ id: "left", kind: "distance", range: 4 });
    expect(meetsRequirements(spec, { sensors: [{ name: "front", kind: "distance" }], gripper: true })).toHaveLength(2);
  });

  it("two sensors cannot share a mount", () => {
    const d = { ...starterDesign(), sensors: [{ part: "ultrasonic", mount: "front" as const }, { part: "lidar-point", mount: "front" as const }] };
    expect(validateDesign(d).ok).toBe(false);
  });
});

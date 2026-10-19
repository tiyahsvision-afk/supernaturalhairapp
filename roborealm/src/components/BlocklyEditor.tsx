"use client";

import { useEffect, useRef } from "react";
import * as Blockly from "blockly/core";
import "blockly/blocks";
import * as En from "blockly/msg/en";
import { Order, pythonGenerator } from "blockly/python";

let defined = false;

function defineBlocks() {
  if (defined) return;
  defined = true;
  Blockly.setLocale(En as unknown as Record<string, string>);
  const MOVE = "#A78BFA";
  const SENSE = "#38BDF8";
  const GRIP = "#FB923C";
  Blockly.common.defineBlocksWithJsonArray([
    { type: "rr_start", message0: "▶ when program starts", nextStatement: null, colour: "#10B981", tooltip: "Your program starts here. Attach blocks underneath." },
    { type: "rr_forward", message0: "move forward %1 m", args0: [{ type: "input_value", name: "DIST", check: "Number" }], previousStatement: null, nextStatement: null, colour: MOVE, inputsInline: true, tooltip: "Drive straight ahead by a distance in metres." },
    { type: "rr_backward", message0: "move backward %1 m", args0: [{ type: "input_value", name: "DIST", check: "Number" }], previousStatement: null, nextStatement: null, colour: MOVE, inputsInline: true },
    { type: "rr_turn_left", message0: "turn left %1 °", args0: [{ type: "input_value", name: "DEG", check: "Number" }], previousStatement: null, nextStatement: null, colour: MOVE, inputsInline: true, tooltip: "Turn anticlockwise on the spot." },
    { type: "rr_turn_right", message0: "turn right %1 °", args0: [{ type: "input_value", name: "DEG", check: "Number" }], previousStatement: null, nextStatement: null, colour: MOVE, inputsInline: true, tooltip: "Turn clockwise on the spot." },
    { type: "rr_wait", message0: "wait %1 s", args0: [{ type: "input_value", name: "SEC", check: "Number" }], previousStatement: null, nextStatement: null, colour: MOVE, inputsInline: true },
    { type: "rr_stop", message0: "stop motors", previousStatement: null, nextStatement: null, colour: MOVE },
    {
      type: "rr_distance",
      message0: "distance sensor %1",
      args0: [{ type: "field_dropdown", name: "SENSOR", options: [["front", "front"], ["left", "left"], ["right", "right"], ["front-left", "front-left"], ["front-right", "front-right"]] }],
      output: "Number",
      colour: SENSE,
      tooltip: "Distance in metres from the robot's edge to the nearest obstacle.",
    },
    { type: "rr_touch", message0: "bump switch pressed?", output: "Boolean", colour: SENSE },
    { type: "rr_say", message0: "print %1", args0: [{ type: "input_value", name: "TEXT" }], previousStatement: null, nextStatement: null, colour: SENSE, inputsInline: true, tooltip: "Show a value in the console." },
    { type: "rr_pick_up", message0: "close gripper (pick up)", previousStatement: null, nextStatement: null, colour: GRIP },
    { type: "rr_drop", message0: "open gripper (drop)", previousStatement: null, nextStatement: null, colour: GRIP },
  ]);
  const g = pythonGenerator;
  const val = (b: Blockly.Block, name: string, d = "0") => g.valueToCode(b, name, Order.NONE) || d;
  g.forBlock["rr_start"] = () => "";
  g.forBlock["rr_forward"] = (b) => `robot.forward(${val(b, "DIST")})\n`;
  g.forBlock["rr_backward"] = (b) => `robot.backward(${val(b, "DIST")})\n`;
  g.forBlock["rr_turn_left"] = (b) => `robot.turn_left(${val(b, "DEG", "90")})\n`;
  g.forBlock["rr_turn_right"] = (b) => `robot.turn_right(${val(b, "DEG", "90")})\n`;
  g.forBlock["rr_wait"] = (b) => `robot.wait(${val(b, "SEC", "1")})\n`;
  g.forBlock["rr_stop"] = () => "robot.stop()\n";
  g.forBlock["rr_distance"] = (b) => [`robot.distance(${JSON.stringify(b.getFieldValue("SENSOR"))})`, Order.FUNCTION_CALL];
  g.forBlock["rr_touch"] = () => ["robot.touch()", Order.FUNCTION_CALL];
  g.forBlock["rr_say"] = (b) => `print(${val(b, "TEXT", "''")})\n`;
  g.forBlock["rr_pick_up"] = () => "robot.pick_up()\n";
  g.forBlock["rr_drop"] = () => "robot.drop()\n";
}

const TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Move",
      colour: "#A78BFA",
      contents: [
        { kind: "block", type: "rr_forward", inputs: { DIST: { shadow: { type: "math_number", fields: { NUM: 0.5 } } } } },
        { kind: "block", type: "rr_backward", inputs: { DIST: { shadow: { type: "math_number", fields: { NUM: 0.5 } } } } },
        { kind: "block", type: "rr_turn_left", inputs: { DEG: { shadow: { type: "math_number", fields: { NUM: 90 } } } } },
        { kind: "block", type: "rr_turn_right", inputs: { DEG: { shadow: { type: "math_number", fields: { NUM: 90 } } } } },
        { kind: "block", type: "rr_wait", inputs: { SEC: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
        { kind: "block", type: "rr_stop" },
      ],
    },
    {
      kind: "category",
      name: "Sense",
      colour: "#38BDF8",
      contents: [
        { kind: "block", type: "rr_distance" },
        { kind: "block", type: "rr_touch" },
        { kind: "block", type: "rr_say", inputs: { TEXT: { shadow: { type: "text", fields: { TEXT: "hello" } } } } },
      ],
    },
    { kind: "category", name: "Gripper", colour: "#FB923C", contents: [{ kind: "block", type: "rr_pick_up" }, { kind: "block", type: "rr_drop" }] },
    {
      kind: "category",
      name: "Loops",
      colour: "#10B981",
      contents: [
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 4 } } } } },
        { kind: "block", type: "controls_whileUntil" },
      ],
    },
    {
      kind: "category",
      name: "Logic",
      colour: "#F472B6",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category",
      name: "Math",
      colour: "#FDE68A",
      contents: [{ kind: "block", type: "math_number" }, { kind: "block", type: "math_arithmetic" }, { kind: "block", type: "text" }],
    },
    { kind: "category", name: "Variables", colour: "#FDBA9A", custom: "VARIABLE" },
  ],
};

export function generatePython(ws: Blockly.Workspace): { code: string; orphans: number } {
  pythonGenerator.init(ws);
  const tops = ws.getTopBlocks(true);
  const start = tops.find((b) => b.type === "rr_start");
  let body = start ? (pythonGenerator.blockToCode(start) as string) : "";
  body = pythonGenerator.finish(body);
  return { code: `# Generated from blocks\n${body.trim()}\n`, orphans: tops.filter((b) => b.type !== "rr_start").length };
}

export function BlocklyEditor({
  initial,
  onChange,
}: {
  initial: object;
  onChange: (state: object, code: string, orphans: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    defineBlocks();
    const theme = Blockly.Theme.defineTheme("roborealm", {
      name: "roborealm",
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: "#101a45",
        toolboxBackgroundColour: "#0f1840",
        toolboxForegroundColour: "#f8fafc",
        flyoutBackgroundColour: "#16225a",
        flyoutForegroundColour: "#f8fafc",
        flyoutOpacity: 0.95,
        scrollbarColour: "#7DD3FC",
        insertionMarkerColour: "#ffffff",
      },
      fontStyle: { family: "Inter, system-ui, sans-serif", weight: "600", size: 12 },
    });
    const ws = Blockly.inject(host.current!, {
      toolbox: TOOLBOX,
      theme,
      renderer: "zelos",
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.85 },
      grid: { spacing: 24, length: 2, colour: "rgba(255,255,255,0.08)", snap: true },
      move: { scrollbars: true, drag: true, wheel: false },
    });
    try {
      Blockly.serialization.workspaces.load(initial, ws);
    } catch {
      Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [{ type: "rr_start", x: 30, y: 30 }] } }, ws);
    }
    const emit = () => {
      const { code, orphans } = generatePython(ws);
      cb.current(Blockly.serialization.workspaces.save(ws), code, orphans);
    };
    emit();
    const listener = (e: Blockly.Events.Abstract) => {
      if (!e.isUiEvent) emit();
    };
    ws.addChangeListener(listener);
    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(host.current!);
    return () => {
      ro.disconnect();
      ws.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={host} className="h-full min-h-[340px] w-full overflow-hidden rounded-2xl" aria-label="Block programming workspace" />;
}

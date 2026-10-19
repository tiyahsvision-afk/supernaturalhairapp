"use client";

import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

// Self-hosted Monaco (copied to /public/monaco by scripts/copy-pyodide.mjs).
loader.config({ paths: { vs: "/monaco/vs" } });

type Monaco = Parameters<OnMount>[1];
type IEditor = Parameters<OnMount>[0];

const API: { label: string; insert: string; doc: string; obj: "robot" | "world" }[] = [
  { obj: "robot", label: "forward", insert: "forward(${1:0.5})", doc: "forward(meters, speed=0.6) → distance travelled. Drive straight." },
  { obj: "robot", label: "backward", insert: "backward(${1:0.5})", doc: "backward(meters, speed=0.6). Reverse." },
  { obj: "robot", label: "turn", insert: "turn(${1:90})", doc: "turn(degrees, speed=0.5). Positive = left (anticlockwise)." },
  { obj: "robot", label: "turn_left", insert: "turn_left(${1:90})", doc: "turn_left(degrees=90)." },
  { obj: "robot", label: "turn_right", insert: "turn_right(${1:90})", doc: "turn_right(degrees=90)." },
  { obj: "robot", label: "set_motors", insert: "set_motors(${1:50}, ${2:50})", doc: "set_motors(left%, right%) — keeps running until changed. Use with wait()." },
  { obj: "robot", label: "wait", insert: "wait(${1:1})", doc: "wait(seconds)." },
  { obj: "robot", label: "stop", insert: "stop()", doc: "Stop both motors." },
  { obj: "robot", label: "distance", insert: 'distance("${1:front}")', doc: "distance(sensor='front') → metres from the robot's edge (max = sensor range)." },
  { obj: "robot", label: "touch", insert: "touch()", doc: "touch() → True while the bump switch is pressed." },
  { obj: "robot", label: "floor", insert: "floor()", doc: "floor() → colour zone under the robot: 'target', 'hazard', 'floor'..." },
  { obj: "robot", label: "position", insert: "position()", doc: "position() → (x, y) in metres." },
  { obj: "robot", label: "heading", insert: "heading()", doc: "heading() → degrees, 0 = east, 90 = north." },
  { obj: "robot", label: "battery", insert: "battery()", doc: "battery() → percent remaining." },
  { obj: "robot", label: "radius", insert: "radius()", doc: "radius() → robot radius in metres." },
  { obj: "robot", label: "pick_up", insert: "pick_up()", doc: "pick_up() → True if an item was within the claw's reach." },
  { obj: "robot", label: "drop", insert: "drop()", doc: "drop() → release the carried item in front of the robot." },
  { obj: "robot", label: "is_carrying", insert: "is_carrying()", doc: "is_carrying() → bool." },
  { obj: "robot", label: "calibrate", insert: 'calibrate("${1:front}", ${2:0.0})', doc: "calibrate(sensor, offset) — add offset (m) to every future reading." },
  { obj: "robot", label: "emergency_stop", insert: "emergency_stop()", doc: "Halt immediately and lock out motion." },
  { obj: "world", label: "target", insert: "target()", doc: "target() → (x, y) of the mission target." },
  { obj: "world", label: "waypoints", insert: "waypoints()", doc: "waypoints() → list of (x, y)." },
  { obj: "world", label: "package", insert: "package()", doc: "package() → (x, y) of the package, or None while carried." },
  { obj: "world", label: "dropoff", insert: "dropoff()", doc: "dropoff() → (x, y) centre of the drop-off zone." },
  { obj: "world", label: "hazards", insert: "hazards()", doc: "hazards() → list of restricted rectangles (x, y, w, h)." },
  { obj: "world", label: "size", insert: "size()", doc: "size() → (width, height) of the arena." },
  { obj: "world", label: "is_clear", insert: "is_clear(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2})", doc: "is_clear(x1, y1, x2, y2) → is the straight path clear on the MAP?" },
  { obj: "world", label: "plan_path", insert: "plan_path(${1:x1}, ${2:y1}, ${3:x2}, ${4:y2})", doc: "plan_path(...) → A* waypoints avoiding mapped obstacles and restricted cells." },
  { obj: "world", label: "report_obstacle", insert: "report_obstacle(${1:x}, ${2:y})", doc: "report_obstacle(x, y, size=0.3) — add an obstacle to the planner's map." },
  { obj: "world", label: "grid", insert: "grid()", doc: "grid() → occupancy grid, 10 cm cells, row 0 at the bottom." },
];

let registered = false;
function register(monaco: Monaco) {
  if (registered) return;
  registered = true;
  monaco.editor.defineTheme("roborealm", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8b9bd6", fontStyle: "italic" },
      { token: "keyword", foreground: "c4b5fd" },
      { token: "number", foreground: "fde68a" },
      { token: "string", foreground: "6ee7b7" },
    ],
    colors: { "editor.background": "#0f1840", "editor.lineHighlightBackground": "#1b2a6b", "editorLineNumber.foreground": "#5b6bb0" },
  });
  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: ["."],
    provideCompletionItems: (model, position) => {
      const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const m = /(robot|world)\.(\w*)$/.exec(line);
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      if (m) {
        return {
          suggestions: API.filter((a) => a.obj === m[1]).map((a) => ({
            label: a.label,
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: a.insert,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: a.doc,
            range,
          })),
        };
      }
      return {
        suggestions: ["robot", "world", "math"].map((w) => ({ label: w, kind: monaco.languages.CompletionItemKind.Module, insertText: w, range })),
      };
    },
  });
}

export function CodeEditor({
  value,
  onChange,
  activeLine,
  errorLine,
  readOnly,
}: {
  value: string;
  onChange?: (v: string) => void;
  activeLine?: number | null;
  errorLine?: number | null;
  readOnly?: boolean;
}) {
  const editorRef = useRef<IEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decos = useRef<string[]>([]);

  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const list = [];
    if (activeLine) {
      list.push({ range: new monaco.Range(activeLine, 1, activeLine, 1), options: { isWholeLine: true, className: "rr-active-line", glyphMarginClassName: "rr-active-glyph" } });
      ed.revealLineInCenterIfOutsideViewport(activeLine);
    }
    if (errorLine) list.push({ range: new monaco.Range(errorLine, 1, errorLine, 1), options: { isWholeLine: true, className: "rr-error-line" } });
    decos.current = ed.deltaDecorations(decos.current, list);
  }, [activeLine, errorLine]);

  return (
    <div className="h-full min-h-[340px] overflow-hidden rounded-2xl border border-white/10">
      <style>{`.rr-active-line{background:rgba(110,231,183,0.18)} .rr-error-line{background:rgba(251,113,133,0.25)}`}</style>
      <Editor
        height="100%"
        defaultLanguage="python"
        value={value}
        theme="roborealm"
        beforeMount={register}
        onMount={(ed, monaco) => {
          editorRef.current = ed;
          monacoRef.current = monaco;
        }}
        onChange={(v) => onChange?.(v ?? "")}
        loading={<div className="p-4 text-sm text-white/60">Loading code editor…</div>}
        options={{
          readOnly,
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: "on",
          automaticLayout: true,
          accessibilitySupport: "auto",
          ariaLabel: "Python code editor",
        }}
      />
    </div>
  );
}

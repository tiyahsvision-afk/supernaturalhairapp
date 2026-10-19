/**
 * Python side of the robot runtime. Executed once per Pyodide instance.
 * Student programs run in a fresh namespace on every run with:
 *   - an import allow-list (no js / pyodide / network modules)
 *   - a line-execution budget enforced with sys.settrace (stops infinite loops)
 *   - stdout captured and attributed to program lines
 * Every robot call goes through _rr_bridge.call(), which advances the
 * deterministic simulation in JavaScript.
 */
export const ROBOT_API_PY = String.raw`
import sys, json, math, builtins, random, traceback
import _rr_bridge as _bridge

_USER_FILE = "main.py"


class RobotError(Exception):
    """The robot could not do what the program asked (missing sensor, e-stop, bad value...)."""


class MissionTimeLimit(BaseException):
    """Simulated time or command budget used up. Not catchable with 'except Exception'."""


class StepLimit(BaseException):
    """Program executed too many lines — usually an infinite loop that never moves the robot."""


_SIMPLE = (int, float, str, bool, type(None))
_HIDDEN_NAMES = {"robot", "world", "math", "random", "RobotError"}


def _snapshot(frame):
    out = {}
    try:
        items = list(frame.f_locals.items())[:60]
    except Exception:
        return out
    for k, v in items:
        if k.startswith("_") or k in _HIDDEN_NAMES:
            continue
        ok = isinstance(v, _SIMPLE) or (
            isinstance(v, (list, tuple)) and len(v) <= 16 and all(isinstance(x, _SIMPLE + (tuple,)) for x in v)
        )
        if ok:
            r = repr(v)
            out[k] = r if len(r) <= 80 else r[:77] + "..."
        if len(out) >= 24:
            break
    return out


def _user_frame():
    f = sys._getframe(1)
    while f is not None and f.f_code.co_filename != _USER_FILE:
        f = f.f_back
    return f


def _call(name, *args):
    f = _user_frame()
    line = f.f_lineno if f else 0
    snap = _snapshot(f) if f else {}
    res = json.loads(_bridge.call(name, json.dumps(args), line, json.dumps(snap)))
    if res["ok"]:
        v = res.get("value")
        return tuple(v) if isinstance(v, list) and name in ("position", "world_target", "world_package", "world_dropoff", "world_size") else v
    if res["code"] in ("TIME_LIMIT", "CALL_LIMIT"):
        raise MissionTimeLimit(res["message"])
    raise RobotError(res["message"])


def _num(v, what):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise TypeError(what + " must be a number, not " + type(v).__name__)
    if v != v or v in (float("inf"), float("-inf")):
        raise ValueError(what + " must be a finite number")
    return float(v)


class Robot:
    """Controls the simulated robot. Distances in metres, angles in degrees."""

    def forward(self, meters, speed=0.6):
        """Drive straight ahead. Returns the distance actually travelled."""
        return _call("forward", _num(meters, "meters"), _num(speed, "speed"))

    def backward(self, meters, speed=0.6):
        return _call("forward", -_num(meters, "meters"), _num(speed, "speed"))

    def turn(self, degrees, speed=0.5):
        """Turn on the spot. Positive = left (anticlockwise), negative = right."""
        return _call("turn", _num(degrees, "degrees"), _num(speed, "speed"))

    def turn_left(self, degrees=90, speed=0.5):
        return _call("turn", _num(degrees, "degrees"), _num(speed, "speed"))

    def turn_right(self, degrees=90, speed=0.5):
        return _call("turn", -_num(degrees, "degrees"), _num(speed, "speed"))

    def set_motors(self, left, right):
        """Set wheel power in percent (-100..100). The robot keeps moving until changed."""
        return _call("set_motors", _num(left, "left"), _num(right, "right"))

    def wait(self, seconds):
        return _call("wait", _num(seconds, "seconds"))

    def stop(self):
        return _call("stop")

    def distance(self, sensor="front"):
        """Distance in metres measured by a distance sensor (from the robot's edge)."""
        return _call("distance", str(sensor))

    def touch(self, sensor="bumper"):
        return _call("touch", str(sensor))

    def floor(self, sensor="floor"):
        return _call("floor", str(sensor))

    def position(self):
        """(x, y) of the robot's centre in metres, from the arena positioning system."""
        return _call("position")

    def heading(self):
        """Heading in degrees: 0 = east, 90 = north, range (-180, 180]."""
        return _call("heading")

    def battery(self):
        """Remaining battery in percent."""
        return _call("battery")

    def radius(self):
        return _call("radius")

    def pick_up(self):
        return _call("pick_up")

    def drop(self):
        return _call("drop")

    def is_carrying(self):
        return _call("is_carrying")

    def calibrate(self, sensor, offset):
        """Apply a calibration offset (metres) to every future reading of a distance sensor."""
        return _call("calibrate", str(sensor), _num(offset, "offset"))

    def emergency_stop(self):
        """Immediately halt all motion. Motion commands are locked out afterwards."""
        return _call("estop")


class World:
    """Read-only information provided by the mission environment."""

    def target(self):
        return _call("world_target")

    def waypoints(self):
        return [tuple(p) for p in _call("world_waypoints")]

    def package(self):
        v = _call("world_package")
        return None if v is None else tuple(v)

    def dropoff(self):
        return _call("world_dropoff")

    def hazards(self):
        return [tuple(r) for r in _call("world_hazards")]

    def size(self):
        return _call("world_size")

    def is_clear(self, x1, y1, x2, y2):
        return _call("world_is_clear", _num(x1, "x1"), _num(y1, "y1"), _num(x2, "x2"), _num(y2, "y2"))

    def plan_path(self, x1, y1, x2, y2):
        return [tuple(p) for p in _call("world_plan_path", _num(x1, "x1"), _num(y1, "y1"), _num(x2, "x2"), _num(y2, "y2"))]

    def report_obstacle(self, x, y, size=0.3):
        return _call("world_report_obstacle", _num(x, "x"), _num(y, "y"), _num(size, "size"))

    def grid(self):
        """Occupancy grid (list of rows, row 0 = bottom), 10 cm cells, 1 = blocked."""
        return _call("world_grid")


robot = Robot()
world = World()


class _Out:
    def write(self, s):
        if s:
            f = _user_frame()
            _bridge.output(s, f.f_lineno if f else 0)
        return len(s)

    def flush(self):
        pass


_ALLOWED = {
    "math", "random", "statistics", "collections", "itertools", "functools", "heapq",
    "bisect", "dataclasses", "typing", "json", "re", "string", "copy", "enum", "fractions", "decimal",
}
_real_import = builtins.__import__


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    root = name.split(".")[0]
    if level != 0 or root not in _ALLOWED:
        raise ImportError("Module '" + name + "' is not available in the ROBOREALM sandbox.")
    return _real_import(name, globals, locals, fromlist, level)


_BLOCKED = {"open", "input", "exec", "eval", "compile", "breakpoint", "exit", "quit", "help", "__import__", "memoryview", "globals", "vars"}
_safe_builtins = {k: v for k, v in builtins.__dict__.items() if k not in _BLOCKED}
_safe_builtins["__import__"] = _safe_import

_state = {"steps": 0, "limit": 3000000}


def _local_trace(frame, event, arg):
    if event == "line":
        _state["steps"] += 1
        if _state["steps"] > _state["limit"]:
            raise StepLimit("Your program ran over " + str(_state["limit"]) + " lines without finishing. Is there a loop that never ends or never moves the robot?")
    return _local_trace


def _global_trace(frame, event, arg):
    if frame.f_code.co_filename == _USER_FILE:
        return _local_trace(frame, event, arg)
    return None


def _rr_run(src, step_limit, seed):
    _state["steps"] = 0
    _state["limit"] = int(step_limit)
    random.seed(int(seed))
    ns = {
        "__builtins__": _safe_builtins,
        "__name__": "__main__",
        "robot": robot,
        "world": world,
        "math": math,
        "RobotError": RobotError,
    }
    try:
        code = builtins.compile(src, _USER_FILE, "exec")
    except SyntaxError as e:
        return json.dumps({"type": type(e).__name__, "message": str(e.msg), "line": e.lineno, "steps": 0})
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = _Out()
    sys.stderr = _Out()
    err = None
    sys.settrace(_global_trace)
    try:
        builtins.exec(code, ns)
    except BaseException as e:
        sys.settrace(None)
        tb = traceback.extract_tb(e.__traceback__)
        line = None
        for fr in reversed(tb):
            if fr.filename == _USER_FILE:
                line = fr.lineno
                break
        err = {"type": type(e).__name__, "message": str(e), "line": line}
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr = old_out, old_err
    if err is None:
        err = {}
    err["steps"] = _state["steps"]
    return json.dumps(err)
`;

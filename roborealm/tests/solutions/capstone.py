# Reference capstone solution used only by the test-suite to prove the
# hidden layouts are solvable. It is never shipped to students.
import math

R = robot.radius()
REACH = R + 0.06


def face(tx, ty):
    x, y = robot.position()
    want = math.degrees(math.atan2(ty - y, tx - x))
    diff = (want - robot.heading() + 180) % 360 - 180
    if abs(diff) > 0.5:
        robot.turn(diff)


def drive_to(tx, ty, stop_short=0.0):
    """Drive in short, re-aimed steps. Returns False if something unexpected blocks the way."""
    while True:
        x, y = robot.position()
        remaining = math.hypot(tx - x, ty - y) - stop_short
        if remaining <= 0.02:
            return True
        face(tx, ty)
        ahead = robot.distance()
        if ahead < min(0.25, remaining):
            return False
        robot.forward(min(0.15, remaining))


def go(tx, ty, stop_short=0.0):
    for attempt in range(6):
        x, y = robot.position()
        path = world.plan_path(x, y, tx, ty)
        if not path:
            return False
        ok = True
        for i, (wx, wy) in enumerate(path):
            last = i == len(path) - 1
            if not drive_to(wx, wy, stop_short if last else 0.0):
                ok = False
                break
        if ok:
            return True
        # Unmapped obstacle ahead: report it and re-plan.
        x, y = robot.position()
        h = math.radians(robot.heading())
        d = robot.distance()
        world.report_obstacle(x + (R + d + 0.15) * math.cos(h), y + (R + d + 0.15) * math.sin(h), 0.4)
        robot.backward(0.1)
    return False


px, py = world.package()
assert go(px, py, REACH), "could not reach package"
face(px, py)
assert robot.pick_up(), "pick up failed"
dx, dy = world.dropoff()
assert go(dx, dy, REACH), "could not reach drop-off"
robot.drop()

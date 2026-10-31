import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from capture import short, snapshot  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
sys.setrecursionlimit(10000)


class Node:
    def __init__(self, v):
        self.value = v
        self.next = None


class Tree:
    def __init__(self, v):
        self.v = v
        self.left = None
        self.right = None


class Slots:
    __slots__ = ("a", "b")

    def __init__(self):
        self.a = 1
        self.b = [2]


def fixture():
    lst = [3, 1, 2]
    d = {"a": 1, "b": [1, 2], 3: {"x": None}}
    a = Node(1)
    b = Node(2)
    a.next = b
    b.next = a  # cycle
    t = Tree(5)
    t.left = Tree(2)
    t.right = Tree(9)
    shared = [0]
    x = {"p": shared}
    y = {"q": shared}  # aliasing
    s = Slots()
    fh = open(__file__)
    th = threading.Lock()
    gen = (i for i in range(3))
    fn = lambda q: q  # noqa: E731
    cls = Node
    return None


def at_return(fn, limits):
    out = {}

    def tr(frame, ev, arg):
        if ev == "return" and frame.f_code is fn.__code__:
            out["snap"] = snapshot(frame, limits)
        return tr

    sys.settrace(tr)
    try:
        fn()
    finally:
        sys.settrace(None)
    return out["snap"]


snap = at_return(fixture, {"depth": 6, "items": 100, "nodes": 500})
json.dump(snap, open(os.path.join(HERE, "shapes_py.json"), "w"), indent=1)
print("cycle a.next.next ->", json.dumps(snap["a"]["fields"]["next"]["fields"]["next"]))
print("alias x['p'] id:", snap["x"]["entries"][0][1]["id"], "| y['q']:", snap["y"]["entries"][0][1])
print("opaque:", {k: snap[k]["kind"] + ":" + snap[k].get("type", "") for k in ("fh", "th", "gen", "fn", "cls")})
print("slots:", snap["s"]["kind"], list(snap["s"]["fields"]))


def mk_list():
    nums = list(range(10000))
    return None


def mk_linked():
    head = Node(0)
    cur = head
    for i in range(1, 1000):
        n = Node(i)
        cur.next = n
        cur = n
    return None


def measure(label, fn, limits):
    res = {}

    def tr(frame, ev, arg):
        if ev == "return" and frame.f_code is fn.__code__:
            t0 = time.perf_counter()
            s = snapshot(frame, limits)
            t1 = time.perf_counter()
            r = {k: short(v) for k, v in frame.f_locals.items()}
            t2 = time.perf_counter()
            res.update(shape_ms=round((t1 - t0) * 1000, 2), repr_ms=round((t2 - t1) * 1000, 3),
                       shape_bytes=len(json.dumps(s)), repr_bytes=len(json.dumps(r)))
        return tr

    sys.settrace(tr)
    try:
        fn()
    finally:
        sys.settrace(None)
    print(label, res)


LIM = {"depth": 6, "items": 100, "nodes": 500}
UNL = {"depth": 10**9, "items": 10**9, "nodes": 10**9}
measure("list10000   limited  ", mk_list, LIM)
measure("list10000   unlimited", mk_list, UNL)
measure("linked1000  limited  ", mk_linked, LIM)
try:
    measure("linked1000  unlimited", mk_linked, UNL)
except RecursionError:
    print("linked1000  unlimited: RecursionError even at recursion limit 10000 (recursive walk)")
    # json.dumps also recurses; retry with a higher limit in a thread with a big stack
    sys.setrecursionlimit(100000)
    threading.stack_size(256 * 1024 * 1024)
    t = threading.Thread(target=lambda: measure("linked1000  unlimited (big stack)", mk_linked, UNL))
    t.start()
    t.join()


def loop():
    nums = list(range(10000))
    for i in range(1000):
        pass
    return None


for name, lim in (("limited", LIM), ("unlimited", UNL)):
    count = [0]

    def tr(frame, ev, arg):
        if frame.f_code is loop.__code__ and ev == "line":
            snapshot(frame, lim)
            count[0] += 1
        return tr

    t0 = time.perf_counter()
    sys.settrace(tr)
    loop()
    sys.settrace(None)
    print("1000 visits over a 10000 list,", name, "total ms", round((time.perf_counter() - t0) * 1000, 1), "visits", count[0])

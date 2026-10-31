class Node:
    def __init__(self, name, next=None):
        self.name = name
        self.next = next


class Slotted:
    __slots__ = ("a", "b")

    def __init__(self):
        self.a = 1


import enum
import sys

CALLS = []  # every call of the person's code that the Shaper must never make; the text form's own repr is allowed


class Loud:
    def __repr__(self):
        CALLS.append("repr:" + sys._getframe(1).f_code.co_name)  # who asked: only the text form (`short`) may
        raise RuntimeError("repr must not be called while recording")

    @property
    def trap(self):
        CALLS.append("property")
        raise RuntimeError("properties must not run while recording")

    def __getattr__(self, name):
        CALLS.append("getattr:" + name)
        raise AttributeError(name)


class Sneaky:
    @property
    def __class__(self):
        CALLS.append("class")
        return Sneaky


class Level(enum.IntEnum):
    HIGH = 2


class Color(str, enum.Enum):
    RED = "red"


class Private:
    __slots__ = ("__x", "y")

    def __init__(self):
        self.__x = 3


class Meta(type):
    @property
    def __name__(cls):
        raise RuntimeError("a failure while shaping must not reach the person's function")


class Weird(metaclass=Meta):
    pass


class Big(list):
    def __repr__(self):
        return "Big"  # the text form would repr a million numbers on every visit and hide what is measured


class Mine(list):
    def __iter__(self):
        raise RuntimeError("the person's __iter__ must not run")

    def __len__(self):
        raise RuntimeError("the person's __len__ must not run")


class Odd:
    def __hash__(self):
        return 1


class Unhashable:
    def __eq__(self, other):
        return False


def make_list():
    items = [1, "two", 3.5]
    return len(items)


def make_dict():
    table = {"a": 1, "nested": {"k": [True, None]}, 7: "seven"}
    return len(table)


def make_cycle():
    first = Node("first")
    second = Node("second", first)
    first.next = second
    return first.name


def make_tree():
    tree = {"left": {"left": None, "right": None}, "right": [1, 2]}
    return len(tree)


def make_alias():
    shared = [1, 2]
    holder = {"p": shared}
    other = {"q": shared}
    return len(holder) + len(other)


def mutate():
    items = [1]
    count = 0
    items.append(2)
    count += 0
    return len(items)


def make_huge():
    big = list(range(10000))
    return len(big)


def make_opaque():
    import io
    f = io.StringIO("text")
    g = lambda x: x
    return g(1)


def make_floats():
    x = float("nan")
    y = float("inf")
    z = 2 ** 80
    return 1


def make_slots():
    s = Slotted()
    return s.a


def make_loud():
    loud = Loud()
    calls = CALLS
    return 1


def make_sneaky():
    sneaky = Sneaky()
    calls = CALLS
    return 1


def make_big_int():
    n = 10 ** 5000
    return 1


def make_big_string():
    s = "x" * 10_000_000
    return 1


def make_weird():
    w = Weird()
    return 1


def make_big_list():
    big = Big(range(1_000_000))
    for i in range(200):
        big[0] = i
    return 1


def make_grid():
    grid = [list(range(200)) for _ in range(200)]
    return 1


def make_singletons():
    a = ()
    b = ()
    c = frozenset()
    d = frozenset()
    x = []
    y = x
    return 1


def make_cut_ref():
    deep = None
    mid = None
    deep = []
    for i in range(10):
        deep = [deep]
        if i == 3:
            mid = deep  # the fourth wrapper: six levels below the outermost, where the depth cut falls
    return 1


def make_enums():
    level = Level.HIGH
    color = Color.RED
    return 1


def make_private():
    p = Private()
    return 1


def wrap(j):
    return [[j]]


def make_many_objects():
    for i in range(80):
        rows = list(map(wrap, range(100)))
    return 1


def make_subclass_and_keys():
    mine = Mine([1, 2])
    table = {(1, (2, 3)): "tuple", Odd(): "odd"}
    pool = [Unhashable(), [1]]
    return 1


def make_deep():
    deep = []
    for _ in range(20):
        deep = [deep]
    return len(deep)


def make_wide():
    wide = list(range(50))
    pile = [list(range(50)) for _ in range(30)]
    return len(wide)


def many_visits():
    big = [list(range(100)) for _ in range(5)]
    for i in range(400):
        big[0][0] = i
    return 1

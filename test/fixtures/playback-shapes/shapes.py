class Node:
    def __init__(self, name, next=None):
        self.name = name
        self.next = next


class Slotted:
    __slots__ = ("a", "b")

    def __init__(self):
        self.a = 1


class Loud:
    def __repr__(self):
        raise RuntimeError("repr must not be called while recording")

    @property
    def trap(self):
        raise RuntimeError("properties must not run while recording")


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

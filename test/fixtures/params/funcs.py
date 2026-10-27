def echo(x):
    return x


def add(a: int, b=2, *rest, c: float = 1.5, **extra):
    return a + b + c


def shapes(name: str, flag: bool, items: list[int], table: dict, pair: tuple, other: Foo, plain, nothing=None, call=len("ab")):
    return name


def positional(a, b=5, /, c=7):
    return (a, b, c)


def save(name):
    with open(name, "w") as f:
        f.write("x")


class Box:
    def put(self, item: int = 1):
        return item


class Counter:
    def __init__(self, start: int, step=1, *, tag: str = "t"):
        self.value = start
        self.step = step

    def bump(self, times: int = 1):
        return self.value + self.step * times


class Bare:
    def run(self):
        return 1


def load(name):
    with open(name) as f:
        return f.read()


def fetch(url):
    return requests.get(url)

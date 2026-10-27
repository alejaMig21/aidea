import random


def drain(total):
    steps = 0
    while total > 100:
        total -= 10
        steps += 1
    return steps


class Counter:
    def __init__(self, start):
        self.value = start

    def bump(self, by):
        self.value += by
        return self.value


def jitter(x):
    return x + random.random()


def save(name):
    with open(name + ".txt", "w") as f:
        f.write("hi")
    return name


def load(name):
    with open(name) as f:
        return f.read()


def greet(name):
    print("hello", name)
    return len(name)


def forever():
    n = 0
    while True:
        n += 1


def divide(a, b):
    return a / b


def helper():
    with open("blocked.txt", "w") as f:
        f.write("x")


def indirect():
    helper()
    return 1


def reader(path):
    return open(path).read()


def peek_outside(path):
    return reader(path)


def peek_inside():
    return reader("data.txt")


def native():
    return load_native()


def load_native():
    import ctypes
    ctypes.pythonapi.Py_GetVersion()
    return 1


def slow():
    import time
    time.sleep(30)
    return 1


import os as o


def aliased():
    o.remove("nothing.txt")


def gen():
    yield 1


def fact(n):
    if n <= 1:
        return 1
    return n * fact(n - 1)

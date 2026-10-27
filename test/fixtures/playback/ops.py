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

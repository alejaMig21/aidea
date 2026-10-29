def drain(total, step=10):
    steps = 0
    while total > 100:
        total -= step
        steps += 1
    return steps


def scale(x):
    return x * 2

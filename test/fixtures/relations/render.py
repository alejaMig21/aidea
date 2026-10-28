import shapes
import util
from shapes import Circle, Square


def draw(shape):
    return shape.area()


def pick(obj, name):
    return getattr(obj, name)()


def run(callback):
    return callback()


handler = draw


def go():
    return handler(1)


def make():
    c = Circle("c")
    return util.scale(shapes.Shape.unit())

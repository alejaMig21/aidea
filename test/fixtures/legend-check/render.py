import shapes
import util
from shapes import Circle


def draw(shape):
    return shape.area()


def pick(obj, name):
    return getattr(obj, name)()


def make():
    c = Circle("c")
    return util.scale(shapes.Shape.unit())

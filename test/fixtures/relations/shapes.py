from abc import ABC, abstractmethod

from external_lib import Mixin
from util import helper


class Shape(ABC):
    def __init__(self, name):
        self.name = name
        self._cache = None

    @abstractmethod
    def area(self):
        ...

    @property
    def label(self):
        return self.name

    @staticmethod
    def unit():
        return 1

    def describe(self):
        return self.area()

    def _hidden(self):
        return 0

    def __len__(self):
        return 0


class Circle(Shape):
    def area(self):
        return 3 * helper(2)


class Square(Shape, Mixin):
    def area(self):
        return 4

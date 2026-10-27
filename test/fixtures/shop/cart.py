class Cart:
    def __init__(self):
        self.items = []

    def add(self, price):
        self.items.append(price)

    def total(self):
        return sum(self.items)


def apply_discount(total, percent):
    if percent > 0:
        return total * (100 - percent) / 100
    return total

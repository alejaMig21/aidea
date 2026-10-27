class Scorer:
    def classify(self, items, limit):
        total = 0
        for item in items:
            if item > limit:
                total += item
        return total


def drain(total):
    while total > 100:
        total -= 10
    return total

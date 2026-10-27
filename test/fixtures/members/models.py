class Account:
    kind = "checking"
    limit: int = 100

    def __init__(self, owner):
        self.owner = owner
        self.balance = 0

    @property
    def summary(self):
        return f"{self.owner}: {self.balance}"

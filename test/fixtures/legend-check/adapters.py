import domain


class Mailer:
    def send(self, order):
        return order


def handle(order):
    return domain.place_order(order)

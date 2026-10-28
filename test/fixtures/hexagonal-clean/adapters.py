import domain
import infra


def handle(order):
    return infra.save(domain.place_order(order))

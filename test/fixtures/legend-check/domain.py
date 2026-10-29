import infra


def place_order(order):
    return infra.save(order)


def notify(order, sender):
    return sender.send(order)

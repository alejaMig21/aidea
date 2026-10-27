from cart import Cart, apply_discount


def run():
    cart = Cart()
    cart.add(10)
    return apply_discount(cart.total(), 10)

from ops import drain, scale

LIMIT = 130


def test_drain_plain():
    assert drain(130) == 3


def test_drain_with_keyword():
    assert drain(total=250, step=50) == 3


def test_drain_unreadable():
    assert drain(LIMIT) == 3
    assert drain(len("abc")) == 0


def test_scale_unreadable():
    assert scale(LIMIT) == 260

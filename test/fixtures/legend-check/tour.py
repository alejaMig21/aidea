def tour(items, mode, path):
    total = 0
    for item in items:
        if item < 0:
            continue
        if item > 99:
            break
        total += item
    while total > 10:
        total -= 1
    print("total", total)
    pick = lambda x: x + 1
    match mode:
        case "fast":
            total += 1
        case _:
            pass
    try:
        data = open(path)
        value = int(data.read())
    except ValueError:
        value = 0
    except (OSError, KeyError):
        raise
    finally:
        print("done")
    with open(path) as handle:
        text = handle.read()
    if total > 5:
        return total
    else:
        return pick(value)

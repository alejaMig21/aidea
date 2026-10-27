def risky(path):
    try:
        data = open(path)
    except OSError:
        return None
    for line in data:
        if not line:
            break
        if line == "#":
            continue
    return data

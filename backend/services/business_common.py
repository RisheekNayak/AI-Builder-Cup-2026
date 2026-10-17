from datetime import date


class BusinessError(ValueError):
    """A request that breaks a business rule. Routers turn it into HTTP 400."""


def inr(amount: float) -> str:
    """Format rupees with Indian digit grouping, e.g. 1420000 -> ₹14,20,000."""
    negative = amount < 0
    whole = str(int(round(abs(amount))))
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups) + "," + tail
    return f"{'-' if negative else ''}₹{whole}"


def inr_short(amount: float) -> str:
    """Compact rupees: ₹14.2 L, ₹1.3 Cr."""
    value = abs(amount)
    if value >= 1e7:
        text = f"₹{value / 1e7:.2f} Cr"
    elif value >= 1e5:
        text = f"₹{value / 1e5:.1f} L"
    else:
        text = inr(value)
    return f"-{text}" if amount < 0 else text


def fy_label(day: date) -> str:
    start = day.year if day.month >= 4 else day.year - 1
    return f"{start % 100:02d}-{(start + 1) % 100:02d}"


def qty(value: float) -> str:
    return f"{int(value):,}" if float(value).is_integer() else f"{value:,.2f}"

from enum import Enum


class AliasScope(str, Enum):
    """Область применения алиаса: магазины или товары."""

    SELLER = "seller"
    PRODUCT = "product"

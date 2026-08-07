from enum import IntEnum


class ReceiptOperationType(IntEnum):
    SALE = 1  # Приход
    REFUND = 2  # Расход
    SALE_RETURN = 3  # Возврат прихода
    REFUND_RETURN = 4  # Возврат расхода

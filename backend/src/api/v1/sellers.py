from uuid import UUID

from fastapi import APIRouter, status
from src.core.dependencies import CurrentUser, SellerSvc
from src.schemas.seller import SellerDeleteResponse, SellerResponse, SellerUpdate

router = APIRouter(prefix="/api/v1/sellers", tags=["sellers"])


@router.get("", response_model=list[SellerResponse])
async def list_sellers(
    current_user: CurrentUser,
    seller_service: SellerSvc,
) -> list[SellerResponse]:
    return [
        SellerResponse(
            seller_id=seller_id,
            seller_name=name,
            normalized_seller_name=normalized,
            alias_id=alias_id,
            alias_name=alias_name,
            transaction_count=transaction_count,
            receipt_count=receipt_count,
            filter_value=normalized,
        )
        for seller_id, name, normalized, alias_id, alias_name, transaction_count, receipt_count in await seller_service.list_management(  # noqa: E501
            current_user.id,
        )
    ]


@router.patch("/{seller_id}", response_model=SellerResponse)
async def update_seller(
    seller_id: UUID,
    data: SellerUpdate,
    current_user: CurrentUser,
    seller_service: SellerSvc,
) -> SellerResponse:
    seller = await seller_service.update(current_user.id, seller_id, data.seller_name)
    rows = await seller_service.list_management(current_user.id)
    row = next(row for row in rows if row[0] == seller.id)
    return SellerResponse(
        seller_id=row[0],
        seller_name=row[1],
        normalized_seller_name=row[2],
        alias_id=row[3],
        alias_name=row[4],
        transaction_count=row[5],
        receipt_count=row[6],
        filter_value=row[2],
    )


@router.delete(
    "/{seller_id}",
    response_model=SellerDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_seller(
    seller_id: UUID,
    current_user: CurrentUser,
    seller_service: SellerSvc,
) -> SellerDeleteResponse:
    seller = await seller_service.get_owned(current_user.id, seller_id)
    await seller_service.delete(current_user.id, seller_id)
    return SellerDeleteResponse(seller_id=seller.id, seller_name=seller.name)

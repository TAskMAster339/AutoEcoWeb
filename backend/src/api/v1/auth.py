from fastapi import APIRouter
from src.core.dependencies import UserRepo
from src.schemas.user import UserCreate, UserResponse, UserUpdate
from src.services.user import UserService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(data: UserCreate, repo: UserRepo) -> UserResponse:
    return await UserService(repo).register(data)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: object,
    repo: UserRepo,
) -> UserResponse:
    return await UserService(repo).update_profile(current_user, data)

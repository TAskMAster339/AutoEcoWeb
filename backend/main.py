from config import settings
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"Hello": settings.postgres_host}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}

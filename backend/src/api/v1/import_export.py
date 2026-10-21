import datetime
import os
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from src.core.dependencies import CurrentUser, ImportExportSvc
from src.schemas.import_export import (
    ImportPreview,
    ImportRequest,
    ImportResult,
)
from src.services.import_export import (
    MAX_FILE_SIZE,
    ImportFormatError,
    ImportLimitError,
    parse_import_file,
)

router = APIRouter(prefix="/api/v1/import-export", tags=["import-export"])

_XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.post("/preview", response_model=ImportPreview)
async def preview_import(
    current_user: CurrentUser,
    import_export_svc: ImportExportSvc,
    file: UploadFile = File(...),  # noqa: B008
) -> ImportPreview:
    """Разобрать файл и вернуть строки предпросмотра (без записи в БД)."""
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл больше 10 МБ")
    try:
        preview = await run_in_threadpool(
            parse_import_file,
            file.filename or "",
            content,
        )
        return await import_export_svc.mark_duplicates(current_user, preview)
    except ImportLimitError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except ImportFormatError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/import", response_model=ImportResult)
async def run_import(
    data: ImportRequest,
    current_user: CurrentUser,
    import_export_svc: ImportExportSvc,
) -> ImportResult:
    """Импортировать подтверждённые строки: авто-создание тегов, bulk-insert."""
    return await import_export_svc.import_rows(current_user, data.rows)


@router.get("/export")
async def export_data(
    current_user: CurrentUser,
    import_export_svc: ImportExportSvc,
    layout: Literal["monthly", "single"] = "monthly",
) -> FileResponse:
    """Выгрузить все транзакции в один лист или с разбивкой по месяцам."""
    path = await import_export_svc.export_file(current_user, layout=layout)
    filename = f"autoeco-export-{datetime.date.today().isoformat()}.xlsx"  # noqa: DTZ011
    return FileResponse(
        path,
        media_type=_XLSX_MEDIA_TYPE,
        filename=filename,
        background=BackgroundTask(os.unlink, path),
    )





- Generate requrements.txt file for backend
```bash
uv export --format requirements-txt --no-dev --no-emit-project --output-file requirements.txt
```

- Migrate local
```bash
cd backend && POSTGRES_HOST=localhost uv run alembic upgrade head
```
- Create migration local
```bash
cd backend && POSTGRES_HOST=localhost uv run alembic revision --autogenerate -m "init users
```

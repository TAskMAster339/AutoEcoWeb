



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
cd backend && POSTGRES_HOST=localhost uv run alembic revision --autogenerate -m "init users"
```
- Admin setup
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "UPDATE users SET role = 'admin' WHERE email = 'test@example.com';"
```
- Status setup
```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "UPDATE users SET status = 'active' WHERE email = 'test@example.com';"
```

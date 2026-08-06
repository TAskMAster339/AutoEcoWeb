up:
	docker compose up -d

down:
	docker compose down

migrate:
	alembic upgrade head

revision:
	alembic revision --autogenerate -m "$(m)"

history:
	alembic history

current:
	alembic current

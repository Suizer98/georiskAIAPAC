# georiskAIAPAC

## Services
- `agent` (port 7000): chat + tool-calling
- `mcp` (port 8000): risk data API
- `db` (port 5432): Postgres

## Run
```
docker compose up --build
```

## Seed risk data
```
docker compose exec mcp python init_db.py
```

## Agent request
```
curl -X POST http://localhost:7000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the risk level for Singapore?"}'
```

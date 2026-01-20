# georiskAIAPAC

![Tech stacks](https://skillicons.dev/icons?i=python,typescript,fastapi,docker,ubuntu,bash)

## Services
- `agent` (port 7000): chat + tool-calling
- `mcp` (port 8000): risk data API
- `db` (port 5432): Postgres

## Start services and clamp down services
```
docker compose up --build
docker compose down -v
```

## .env
Create a `.env` file at the repo root with your credentials.
Example:
```
GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=llama-3.1-8b-instant
POSTGRES_USER=georisk
POSTGRES_PASSWORD=georisk_password
POSTGRES_DB=georisk
```

## Seed risk data manually when instance is up
```
docker compose exec mcp python init_db.py
```

## Agent request
```
curl -X POST http://localhost:7000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the risk level for Singapore?"}'
```

## Risk calculation references
- Formula: `Risk = 25 * (Military + Hazard + (1 - Economy) + (1 - Safety))` (0–100)
- Sources:
  - Military: GDELT GEO 2.0 (conflict events, last 24h)
  - Hazard: USGS Earthquake API (M5.5+ within ~220km, last 365 days)
  - Economy: World Bank GDP per capita (NY.GDP.PCAP.CD)
  - Safety: World Bank intentional homicides (VC.IHR.PSRC.P5)
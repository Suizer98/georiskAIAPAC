# georiskAIAPAC

![Tech stacks](https://skillicons.dev/icons?i=python,typescript,fastapi,react,docker,ubuntu,bash)

## Services
- `frontend`: consists of interactive web map and chatbot
- `agent`: how chat is handled + tool-calling
- `mcp`: risk data API and interfacing with database
- `db`: Postgres

## Start services and clamp down services
```
docker compose up --build
docker compose down -v
```

## .env
Create a `.env` file at the repo root with your credentials.
Example:
```
POSTGRES_USER=georisk
POSTGRES_PASSWORD=georisk123
POSTGRES_DB=georiskdb

GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-1.5-flash

VITE_BACKEND_MCP=http://localhost:8000
VITE_BACKEND_AGENT=http://localhost:7000
```

## Seed risk data manually when instance is up
```
docker compose exec mcp python init_db.py
```

## Endpoints and Swagger interface
- Frontend: http://localhost:3000
- Agent API: http://localhost:7000/docs
- MCP API: http://localhost:8000/docs
- Databse: http://localhost:5432/

## Risk calculation references
- Formula: `Risk = 25 * (Military + Hazard + (1 - Economy) + (1 - Safety))` (0–100)
- Sources:
  - Military: GDELT GEO 2.0 (conflict events, last 24h)
  - Hazard: USGS Earthquake API (M5.5+ within ~220km, last 365 days)
  - Economy: World Bank GDP per capita (NY.GDP.PCAP.CD)
  - Safety: World Bank intentional homicides (VC.IHR.PSRC.P5)
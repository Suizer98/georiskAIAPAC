import logging

from fastapi import FastAPI

from constant import GDELT_HOTSPOT_TIMESPAN
from db import Base, SessionLocal, engine
from init_db import seed_data
from models import RiskData, GdeltDisplay
from routes import _fetch_gdelt_hotspots, router

app = FastAPI()
app.include_router(router)


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        count = db.query(RiskData.id).count()
    finally:
        db.close()
    logging.getLogger(__name__).info("risk_data_count_on_startup=%s", count)
    if count == 0:
        summary = seed_data()
        logging.getLogger(__name__).info("seed_data_on_startup summary=%s", summary)
        db = SessionLocal()
        try:
            count_after = db.query(RiskData.id).count()
        finally:
            db.close()
        logging.getLogger(__name__).info("risk_data_count_after_seed=%s", count_after)

    # On startup: query GDELT military (lat/lon) and write to DB so frontend GET /api/gdelt returns data without calling GDELT API.
    db = SessionLocal()
    try:
        query, timespan, features = await _fetch_gdelt_hotspots(
            "military", GDELT_HOTSPOT_TIMESPAN
        )
        row = db.query(GdeltDisplay).first()
        if row:
            row.query = query
            row.timespan = timespan
            row.set_features(features)
        else:
            row = GdeltDisplay(query=query, timespan=timespan)
            row.set_features(features)
            db.add(row)
        db.commit()
        logging.getLogger(__name__).info("gdelt_display_on_startup query=%s", query)
    finally:
        db.close()

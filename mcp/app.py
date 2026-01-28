import logging

from fastapi import FastAPI

from db import Base, SessionLocal, engine
from init_db import seed_data
from models import RiskData
from routes import router

app = FastAPI()
app.include_router(router)


@app.on_event("startup")
def startup():
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

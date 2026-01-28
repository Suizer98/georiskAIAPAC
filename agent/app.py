from fastapi import FastAPI

from chat import router as chat_router
from db import Base, engine

app = FastAPI()
app.include_router(chat_router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}

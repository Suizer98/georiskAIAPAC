from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from db import Base


class RiskData(Base):
    __tablename__ = "risk_data"

    id = Column(Integer, primary_key=True, index=True)
    country = Column(String(100), nullable=False)
    city = Column("region", String(100))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    risk_level = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.utcnow)

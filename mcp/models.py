import json
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


class GdeltDisplay(Base):  # GDELT display row (query/timespan/features)
    __tablename__ = "gdelt_display"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String(256), nullable=False, default="military")
    timespan = Column(String(32), nullable=False, default="24h")
    features = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow)

    def get_features(self) -> list:
        if not self.features:
            return []
        try:
            return json.loads(self.features)
        except (TypeError, ValueError):
            return []

    def set_features(self, value: list) -> None:
        self.features = json.dumps(value) if value else None

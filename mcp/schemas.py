from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RiskDataCreate(BaseModel):
    country: str
    city: str
    latitude: float
    longitude: float
    risk_level: float = 0.0


class RiskDataUpdate(BaseModel):
    country: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    risk_level: Optional[float] = None


class RiskDataOut(BaseModel):
    id: int
    country: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    risk_level: float
    updated_at: datetime

    class Config:
        from_attributes = True


class GdeltDisplayOut(BaseModel):
    """Response schema for GET/POST /api/gdelt (query, timespan, features)."""

    query: str
    timespan: str
    features: list

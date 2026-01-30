import logging

from db import Base, SessionLocal, engine
from models import RiskData

# Seed data for APAC cities with initial risk levels
# Note: Actual risk calculation uses: 25*military + 25*(1-economy) + 25*(1-safety) + 15*uncertainty + 10*ambassy_advice

# Seed data for APAC cities with initial risk levels
asia_pacific_countries = [
    {
        "country": "Australia",
        "city": "Sydney",
        "lat": -33.8688,
        "lon": 151.2093,
        "risk_level": 23.0,
    },
    {
        "country": "Australia",
        "city": "Melbourne",
        "lat": -37.8136,
        "lon": 144.9631,
        "risk_level": 23.0,
    },
    {
        "country": "China",
        "city": "Beijing",
        "lat": 39.9042,
        "lon": 116.4074,
        "risk_level": 23.0,
    },
    {
        "country": "China",
        "city": "Shanghai",
        "lat": 31.2304,
        "lon": 121.4737,
        "risk_level": 28.0,
    },
    {
        "country": "Japan",
        "city": "Tokyo",
        "lat": 35.6762,
        "lon": 139.6503,
        "risk_level": 28.0,
    },
    {
        "country": "Japan",
        "city": "Osaka",
        "lat": 34.6937,
        "lon": 135.5023,
        "risk_level": 28.0,
    },
    {
        "country": "South Korea",
        "city": "Seoul",
        "lat": 37.5665,
        "lon": 126.9780,
        "risk_level": 35.0,
    },
    {
        "country": "India",
        "city": "New Delhi",
        "lat": 28.6139,
        "lon": 77.2090,
        "risk_level": 48.0,
    },
    {
        "country": "India",
        "city": "Mumbai",
        "lat": 19.0760,
        "lon": 72.8777,
        "risk_level": 43.0,
    },
    {
        "country": "Singapore",
        "city": "Singapore",
        "lat": 1.3521,
        "lon": 103.8198,
        "risk_level": 5.0,
    },
    {
        "country": "Malaysia",
        "city": "Kuala Lumpur",
        "lat": 3.1390,
        "lon": 101.6869,
        "risk_level": 28.0,
    },
    {
        "country": "Thailand",
        "city": "Bangkok",
        "lat": 13.7563,
        "lon": 100.5018,
        "risk_level": 43.0,
    },
    {
        "country": "Philippines",
        "city": "Manila",
        "lat": 14.5995,
        "lon": 120.9842,
        "risk_level": 58.0,
    },
    {
        "country": "Indonesia",
        "city": "Jakarta",
        "lat": -6.2088,
        "lon": 106.8456,
        "risk_level": 50.0,
    },
    {
        "country": "Vietnam",
        "city": "Hanoi",
        "lat": 21.0285,
        "lon": 105.8542,
        "risk_level": 43.0,
    },
    {
        "country": "New Zealand",
        "city": "Auckland",
        "lat": -36.8485,
        "lon": 174.7633,
        "risk_level": 18.0,
    },
]


logger = logging.getLogger(__name__)


def seed_data() -> dict:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    inserted = 0
    updated = 0
    try:
        for country_data in asia_pacific_countries:
            existing = (
                db.query(RiskData)
                .filter(
                    RiskData.country == country_data["country"],
                    RiskData.city == country_data["city"],
                )
                .first()
            )
            if not existing:
                risk = RiskData(
                    country=country_data["country"],
                    city=country_data["city"],
                    latitude=country_data["lat"],
                    longitude=country_data["lon"],
                    risk_level=country_data.get("risk_level", 0.0),
                )
                db.add(risk)
                inserted += 1
            else:
                # Update existing records with new default values if they are 0.0 or outdated
                # Ideally, we might want to force update them to reflect the new research.
                # For this task, I will update them to match the new research.
                existing.risk_level = country_data.get("risk_level", 0.0)
                db.add(existing)
                updated += 1

        db.commit()
        summary = {
            "inserted": inserted,
            "updated": updated,
            "total": inserted + updated,
        }
        logger.info(
            "Database initialized/updated with Asia Pacific countries with mocked data. summary=%s",
            summary,
        )
        return summary
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()

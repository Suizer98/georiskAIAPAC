"""Constants for the GeoRisk AI APAC application."""

from datetime import timedelta

# Countries
APAC_COUNTRIES = [
    "Australia",
    "China",
    "Hong Kong",
    "India",
    "Indonesia",
    "Japan",
    "Malaysia",
    "New Zealand",
    "Philippines",
    "Singapore",
    "South Korea",
    "Taiwan",
    "Thailand",
    "Vietnam",
]

# Cache settings
CACHE_TTL_MINUTES = 10
CACHE_TTL = timedelta(minutes=CACHE_TTL_MINUTES)

# API URLs
RESTCOUNTRIES_API_URL = "https://restcountries.com/v3.1/name"
WORLDBANK_API_URL = "https://api.worldbank.org/v2/country"
USGS_EARTHQUAKE_API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/count"
GDELT_DOC_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_GEO_API_URL = "https://api.gdeltproject.org/api/v2/geo/geo"
EXCHANGERATE_API_URL = "https://api.exchangerate.host/latest"
METALPRICE_API_URL = "https://api.metalpriceapi.com/v1/latest"
GOLDPRICE_API_URL = "https://data-asg.goldprice.org/dbXRates/USD"
ER_API_URL = "https://open.er-api.com/v6/latest/USD"

# Timeout values (seconds)
TIMEOUT_SHORT = 5
TIMEOUT_MEDIUM = 8
TIMEOUT_STANDARD = 10
TIMEOUT_LONG = 15
TIMEOUT_API = 30

# HTTP settings
HTTP_USER_AGENT = "Mozilla/5.0"
HTTP_QUEUE_MAXSIZE = 10

# Units
METALS_UNIT = "troy oz"

# GDELT timespans
GDELT_TIMESPAN_7D = "7d"
GDELT_TIMESPAN_24H = "24h"
GDELT_TIMESPAN_30D = "30d"

"""Constants for the GeoRisk AI APAC application."""

from datetime import timedelta

# Countries
# APAC (Asia-Pacific) region includes:
# - East Asia: China, Japan, South Korea, Taiwan, Hong Kong
# - Southeast Asia: All 10 ASEAN countries
# - South Asia: India
# - Oceania: Australia, New Zealand
APAC_COUNTRIES = [
    "Australia",
    "Brunei",
    "Cambodia",
    "China",
    "Hong Kong",
    "India",
    "Indonesia",
    "Japan",
    "Laos",
    "Malaysia",
    "Myanmar",
    "New Zealand",
    "Philippines",
    "Singapore",
    "South Korea",
    "Taiwan",
    "Thailand",
    "Vietnam",
]

# Place name -> (latitude, longitude) for map_zoom_to_place (APAC countries + major cities)
PLACE_TO_COORDINATES: dict[str, tuple[float, float]] = {
    "singapore": (1.3521, 103.8198),
    "jakarta": (-6.2088, 106.8456),
    "shanghai": (31.2304, 121.4737),
    "beijing": (39.9042, 116.4074),
    "hong kong": (22.3193, 114.1694),
    "tokyo": (35.6762, 139.6503),
    "osaka": (34.6937, 135.5023),
    "bangkok": (13.7563, 100.5018),
    "manila": (14.5995, 120.9842),
    "kuala lumpur": (3.1390, 101.6869),
    "hanoi": (21.0278, 105.8342),
    "ho chi minh city": (10.8231, 106.6297),
    "ho chi minh": (10.8231, 106.6297),
    "sydney": (-33.8688, 151.2093),
    "melbourne": (-37.8136, 145.9631),
    "mumbai": (19.0760, 72.8777),
    "new delhi": (28.6139, 77.2090),
    "seoul": (37.5665, 126.9780),
    "taipei": (25.0330, 121.5654),
    "phnom penh": (11.5564, 104.9160),
    "yangon": (16.8661, 96.1951),
    "vientiane": (17.9757, 102.6331),
    "bandar seri begawan": (4.9031, 114.9398),
    "wellington": (-41.2866, 174.7762),
    "australia": (-25.2744, 133.7751),
    "japan": (36.2048, 138.2529),
    "china": (35.8617, 104.1954),
    "india": (20.5937, 78.9629),
    "indonesia": (-0.7893, 113.9213),
    "thailand": (15.8700, 100.9925),
    "malaysia": (4.2105, 101.9758),
    "philippines": (12.8797, 121.7740),
    "vietnam": (14.0583, 108.2772),
    "south korea": (35.9078, 127.7669),
    "taiwan": (23.6978, 120.9605),
    "cambodia": (12.5657, 104.9903),
    "myanmar": (21.9162, 95.9560),
    "laos": (19.8563, 102.4955),
    "brunei": (4.5353, 114.7277),
    "new zealand": (-40.9006, 174.8860),
}

# ISO2 code mapping for APAC countries (to avoid API calls)
APAC_ISO2_MAP = {
    "Australia": "AU",
    "Brunei": "BN",
    "Cambodia": "KH",
    "China": "CN",
    "Hong Kong": "HK",
    "India": "IN",
    "Indonesia": "ID",
    "Japan": "JP",
    "Laos": "LA",
    "Malaysia": "MY",
    "Myanmar": "MM",
    "New Zealand": "NZ",
    "Philippines": "PH",
    "Singapore": "SG",
    "South Korea": "KR",
    "Taiwan": "TW",
    "Thailand": "TH",
    "Vietnam": "VN",
}

# Cache settings
CACHE_TTL_MINUTES = 10
CACHE_TTL = timedelta(minutes=CACHE_TTL_MINUTES)

# API URLs
RESTCOUNTRIES_API_URL = "https://restcountries.com/v3.1/name"
WORLDBANK_API_URL = "https://api.worldbank.org/v2/country"
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
GDELT_TIMESPAN_24H = "24h"
GDELT_TIMESPAN_30D = "30d"

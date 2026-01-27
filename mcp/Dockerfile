FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PATH="/opt/venv/bin:$PATH"

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app", "--reload-delay", "0.5", "--reload-include", "*.py"]

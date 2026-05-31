# NegotiAI agent service (FastAPI + LangGraph). Python 3.12 (stable wheels for langchain stack).
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Shell form so $PORT expands; bind :: (IPv6) for Railway private networking
# (also accepts IPv4-mapped, so docker-compose dev keeps working).
CMD uvicorn app.main:app --host :: --port ${PORT:-8000}

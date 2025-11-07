FROM python:3.11-slim
WORKDIR /app
RUN pip install poetry
COPY apps/api/pyproject.toml apps/api/poetry.lock* ./
RUN poetry config virtualenvs.create false && poetry install --no-interaction --no-ansi --no-root
COPY apps/api/app ./app
ENV PORT=8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]
EXPOSE 8000




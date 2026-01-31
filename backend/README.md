# Backend (FastAPI)

## Rodar local
1) Suba o Postgres:
```bash
cd ../infra
docker compose up -d
```

2) Crie o venv e instale deps:
```bash
cd ../backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
```

3) Copie env:
```bash
cp .env.example .env
```

4) Rode:
```bash
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs
- Admin seed (criado no startup): username `admin` / password `admin123` (ajuste no .env)

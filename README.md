# Bar Control (React + FastAPI + PostgreSQL)

## 1) Subir Postgres (local)
```bash
cd infra
docker compose up -d
```

## 2) Rodar backend (local)
```bash
cd ../backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## 3) Rodar frontend (local)
```bash
cd ../frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000/docs

## Deploy (AWS EC2 + Traefik)
1) EC2 com Docker + Docker Compose instalados.
2) Elastic IP associada e domínio na Route 53 apontando para ela.
   - Crie um registro `A` para `seu-dominio.com` e `api.seu-dominio.com`.
3) No servidor:
```bash
git clone <repo> /opt/bar-control
cd /opt/bar-control
cp infra/.env.example infra/.env
cp backend/.env.example backend/.env
```
4) Ajuste `infra/.env` com domínio, email e credenciais do Postgres.
5) Ajuste `backend/.env` (troque `JWT_SECRET`, seed admin etc.).
6) Crie o arquivo do ACME e permissao:
```bash
sudo mkdir -p /opt/bar-control/infra/traefik
sudo touch /opt/bar-control/infra/traefik/acme.json
sudo chmod 600 /opt/bar-control/infra/traefik/acme.json
```
7) Suba os containers:
```bash
cd /opt/bar-control/infra
docker compose -f docker-compose.prod.yml up -d --build
```

- Frontend: https://seu-dominio.com
- Backend: https://api.seu-dominio.com/docs

## Persistencia de dados
- O Postgres usa volume `pgdata`. Nao rode `docker compose down -v`.
- Para backup: `pg_dump` periodicamente.

## Login padrao (seed)
- username: admin
- password: admin123

> Ajuste no `backend/.env`.

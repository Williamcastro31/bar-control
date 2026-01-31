from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import engine, SessionLocal, Base
from app.models import models  # noqa: F401 (register models)
from app.models.models import User, Role
from app.core.security import hash_password

from app.routes.auth import router as auth_router
from app.routes.admin import router as admin_router
from app.routes.produtos import router as produtos_router
from app.routes.comandas import router as comandas_router
from app.routes.logs import router as logs_router
from app.routes.mesas import router as mesas_router
from app.routes.caixa import router as caixa_router

app = FastAPI(title="Bar Control API", version="0.1.0")

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(produtos_router)
app.include_router(comandas_router)
app.include_router(logs_router)
app.include_router(mesas_router)
app.include_router(caixa_router)

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # seed admin if not exists
        admin = db.query(User).filter(User.username == settings.SEED_ADMIN_USERNAME).first()
        if not admin:
            admin = User(
                nome=settings.SEED_ADMIN_NAME,
                username=settings.SEED_ADMIN_USERNAME,
                password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
                role=Role.ADMIN,
                ativo=True
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()

@app.get("/health")
def health():
    return {"ok": True}

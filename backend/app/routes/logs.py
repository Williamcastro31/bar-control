from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import require_admin
from app.models.models import LogAcao
from app.schemas.logs import LogOut

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/", response_model=list[LogOut])
def listar_logs(limit: int = 200, db: Session = Depends(get_db), admin=Depends(require_admin)):
    q = select(LogAcao).order_by(LogAcao.data_hora.desc()).limit(min(limit, 1000))
    return db.execute(q).scalars().all()

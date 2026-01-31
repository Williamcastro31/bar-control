from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import require_vendedor
from app.models.models import Mesa
from app.schemas.mesas import MesaOut

router = APIRouter(prefix="/mesas", tags=["mesas"])

@router.get("/", response_model=list[MesaOut])
def listar_mesas(db: Session = Depends(get_db), user=Depends(require_vendedor)):
    return db.execute(select(Mesa).where(Mesa.ativo == True)).scalars().all()

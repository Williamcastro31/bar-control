from sqlalchemy.orm import Session
from app.models.models import LogAcao

def log_action(db: Session, usuario: str, acao: str, detalhe: str | None = None, ip: str | None = None):
    db.add(LogAcao(usuario=usuario, acao=acao, detalhe=detalhe, ip=ip))

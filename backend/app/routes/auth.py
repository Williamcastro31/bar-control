from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.auth import LoginIn, TokenOut
from app.models.models import User
from app.core.security import verify_password, create_access_token
from app.services.log_service import log_action

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not user.ativo or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos.")

    token = create_access_token({"sub": str(user.id), "role": user.role, "nome": user.nome})
    log_action(db, user.nome, "LOGIN", "Login realizado", None)
    db.commit()
    return TokenOut(access_token=token, role=user.role, nome=user.nome, user_id=user.id)

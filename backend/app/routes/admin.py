from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import require_admin, hash_password
from app.models.models import User, Role, Mesa
from app.schemas.users import UserCreate, UserOut, UserUpdate
from app.schemas.mesas import MesaCreate, MesaOut
from app.services.log_service import log_action

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/vendedores", response_model=UserOut)
def criar_vendedor(payload: UserCreate, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="username já existe.")

    role = payload.role if payload.role in ("ADMIN", "VENDEDOR", "CAIXA") else "VENDEDOR"
    u = User(
        nome=payload.nome,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=Role(role),
        ativo=True
    )
    db.add(u)
    log_action(db, admin.nome, "CRIAR_USUARIO", f"username={payload.username} role={role}", request.client.host if request.client else None)
    db.commit()
    db.refresh(u)
    return u

@router.get("/vendedores", response_model=list[UserOut])
def listar_vendedores(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return db.execute(select(User)).scalars().all()

@router.put("/vendedores/{id_user}", response_model=UserOut)
def atualizar_vendedor(id_user: int, payload: UserUpdate, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    u = db.get(User, id_user)
    if not u:
        raise HTTPException(status_code=404, detail="usuario nao encontrado.")
    data = payload.model_dump(exclude_unset=True)
    if "role" in data and data["role"] is not None:
        role = data["role"] if data["role"] in ("ADMIN", "VENDEDOR", "CAIXA") else "VENDEDOR"
        data["role"] = Role(role)
    if "password" in data:
        password = data.pop("password")
        if password:
            data["password_hash"] = hash_password(password)
    for k, v in data.items():
        setattr(u, k, v)
    log_action(db, admin.nome, "ATUALIZAR_USUARIO", f"id={id_user}", request.client.host if request.client else None)
    db.commit()
    db.refresh(u)
    return u

@router.post("/mesas", response_model=MesaOut)
def criar_mesa(payload: MesaCreate, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    exists = db.query(Mesa).filter(Mesa.numero == payload.numero).first()
    if exists:
        raise HTTPException(status_code=400, detail="mesa ja existe.")

    mesa = Mesa(
        numero=payload.numero,
        descricao=payload.descricao,
        ativo=payload.ativo
    )
    db.add(mesa)
    log_action(db, admin.nome, "CRIAR_MESA", f"numero={payload.numero}", request.client.host if request.client else None)
    db.commit()
    db.refresh(mesa)
    return mesa

@router.get("/mesas", response_model=list[MesaOut])
def listar_mesas(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return db.execute(select(Mesa)).scalars().all()

@router.put("/mesas/{id_mesa}", response_model=MesaOut)
def atualizar_mesa(id_mesa: int, payload: MesaCreate, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    mesa = db.get(Mesa, id_mesa)
    if not mesa:
        raise HTTPException(status_code=404, detail="mesa nao encontrada.")

    mesa.numero = payload.numero
    mesa.descricao = payload.descricao
    mesa.ativo = payload.ativo
    log_action(db, admin.nome, "ATUALIZAR_MESA", f"id={id_mesa}", request.client.host if request.client else None)
    db.commit()
    db.refresh(mesa)
    return mesa

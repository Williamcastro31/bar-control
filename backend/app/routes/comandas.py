from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from datetime import timezone
from app.db.session import get_db
from app.core.security import require_vendedor
from app.models.models import (
    Comanda, ComandaStatus, ItemComanda, Role, User, Produto,
    Caixa, CaixaMov, CaixaMovTipo, CaixaStatus
)
from app.schemas.comandas import ComandaCreate, ComandaOut, AddItemIn, ItemOut
from app.services.comanda_service import add_item_comanda, remove_item_comanda, cancel_comanda, finalizar_comanda
from app.services.log_service import log_action

router = APIRouter(prefix="/comandas", tags=["comandas"])
try:
    BR_TZ = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    BR_TZ = timezone(timedelta(hours=-3))

def _comanda_to_out(db: Session, c: Comanda) -> dict:
    vendedor_nome = None
    vendedor = db.get(User, c.id_vendedor)
    if vendedor:
        vendedor_nome = vendedor.nome
    return {
        "id": c.id,
        "id_vendedor": c.id_vendedor,
        "mesa": c.mesa,
        "observacao": c.observacao,
        "status": c.status.value if hasattr(c.status, "value") else c.status,
        "valor_total": c.valor_total,
        "vendedor_nome": vendedor_nome,
    }

def _ensure_comanda_access(db: Session, id_comanda: int, user):
    comanda = db.get(Comanda, id_comanda)
    if not comanda:
        raise HTTPException(status_code=404, detail="Comanda nao encontrada.")
    if user.role != Role.ADMIN and comanda.id_vendedor != user.id:
        raise HTTPException(status_code=403, detail="Acesso restrito ao vendedor da comanda.")
    return comanda


@router.post("/", response_model=ComandaOut)
def criar_comanda(
    request: Request,
    payload: ComandaCreate | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_vendedor)
):
    vendedor_id = user.id
    if user.role == Role.ADMIN and payload and payload.id_vendedor:
        vendedor_id = payload.id_vendedor

    mesa = payload.mesa if payload else None
    observacao = payload.observacao if payload else None
    c = Comanda(id_vendedor=vendedor_id, mesa=mesa, observacao=observacao, status=ComandaStatus.ABERTA, valor_total=0)
    db.add(c)
    log_action(db, user.nome, "CRIAR_COMANDA", f"vendedor_id={vendedor_id}", request.client.host if request.client else None)
    db.commit()
    db.refresh(c)
    return _comanda_to_out(db, c)

@router.get("/abertas", response_model=list[ComandaOut])
def listar_abertas(db: Session = Depends(get_db), user=Depends(require_vendedor)):
    stmt = select(Comanda).where(Comanda.status == ComandaStatus.ABERTA)
    if user.role != Role.ADMIN:
        stmt = stmt.where(Comanda.id_vendedor == user.id)
    comandas = db.execute(stmt).scalars().all()
    return [_comanda_to_out(db, c) for c in comandas]

@router.get("/{id_comanda}/itens", response_model=list[ItemOut])
def listar_itens(id_comanda: int, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    _ensure_comanda_access(db, id_comanda, user)
    return db.execute(select(ItemComanda).where(ItemComanda.id_comanda == id_comanda)).scalars().all()

@router.post("/{id_comanda}/itens")
def adicionar_item(id_comanda: int, payload: AddItemIn, request: Request, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    _ensure_comanda_access(db, id_comanda, user)
    try:
        res = add_item_comanda(db, id_comanda, payload.id_produto, payload.quantidade)
        log_action(db, user.nome, "ADD_ITEM_COMANDA", f"comanda={id_comanda} produto={payload.id_produto} qtd={payload.quantidade}", request.client.host if request.client else None)
        db.commit()
        return res
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))

@router.delete("/itens/{item_id}")
def remover_item(item_id: int, request: Request, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    try:
        item = db.get(ItemComanda, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Item nao encontrado.")
        _ensure_comanda_access(db, item.id_comanda, user)
        remove_item_comanda(db, item_id)
        log_action(db, user.nome, "REMOVER_ITEM_COMANDA", f"item_id={item_id}", request.client.host if request.client else None)
        db.commit()
        return {"ok": True}
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))

@router.post("/{id_comanda}/cancelar")
def cancelar(id_comanda: int, request: Request, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    _ensure_comanda_access(db, id_comanda, user)
    try:
        cancel_comanda(db, id_comanda)
        log_action(db, user.nome, "CANCELAR_COMANDA", f"comanda={id_comanda}", request.client.host if request.client else None)
        db.commit()
        return {"ok": True}
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))

@router.post("/{id_comanda}/finalizar")
def finalizar(id_comanda: int, request: Request, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    _ensure_comanda_access(db, id_comanda, user)
    try:
        finalizar_comanda(db, id_comanda)
        log_action(db, user.nome, "FINALIZAR_COMANDA", f"comanda={id_comanda}", request.client.host if request.client else None)
        caixa = db.execute(select(Caixa).where(Caixa.status == CaixaStatus.ABERTO)).scalars().first()
        if caixa:
            comanda = db.get(Comanda, id_comanda)
            if comanda:
                db.add(CaixaMov(
                    id_caixa=caixa.id,
                    tipo=CaixaMovTipo.VENDA,
                    valor=comanda.valor_total,
                    descricao=f"Comanda #{comanda.id}",
                    criado_em=datetime.now(BR_TZ)
                ))
        db.commit()
        return {"ok": True}
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))

@router.get("/resumo-dia")
def resumo_dia(db: Session = Depends(get_db), user=Depends(require_vendedor)):
    today = datetime.now(BR_TZ)
    start = today.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)

    base = select(Comanda).where(
        Comanda.status == ComandaStatus.FINALIZADA,
        Comanda.atualizada_em >= start,
        Comanda.atualizada_em < end
    )
    if user.role != Role.ADMIN:
        base = base.where(Comanda.id_vendedor == user.id)

    total_stmt = select(func.coalesce(func.sum(Comanda.valor_total), 0)).where(
        Comanda.status == ComandaStatus.FINALIZADA,
        Comanda.atualizada_em >= start,
        Comanda.atualizada_em < end
    )
    if user.role != Role.ADMIN:
        total_stmt = total_stmt.where(Comanda.id_vendedor == user.id)
    total_vendas = db.execute(total_stmt).scalar_one()

    comandas = db.execute(base.order_by(Comanda.atualizada_em.desc())).scalars().all()

    prod_stmt = select(
        Produto.id,
        Produto.nome,
        func.sum(ItemComanda.quantidade).label("qtd"),
        func.sum(ItemComanda.total_item).label("total")
    ).join(ItemComanda, ItemComanda.id_produto == Produto.id).join(
        Comanda, Comanda.id == ItemComanda.id_comanda
    ).where(
        Comanda.status == ComandaStatus.FINALIZADA,
        ItemComanda.criado_em >= start,
        ItemComanda.criado_em < end
    )
    if user.role != Role.ADMIN:
        prod_stmt = prod_stmt.where(Comanda.id_vendedor == user.id)
    prod_stmt = prod_stmt.group_by(Produto.id, Produto.nome).order_by(func.sum(ItemComanda.total_item).desc())

    produtos = [
        {"id": pid, "nome": nome, "quantidade": qtd, "total": total}
        for pid, nome, qtd, total in db.execute(prod_stmt).all()
    ]

    vend_stmt = select(
        User.id,
        User.nome,
        func.coalesce(func.sum(Comanda.valor_total), 0).label("total")
    ).join(Comanda, Comanda.id_vendedor == User.id).where(
        Comanda.status == ComandaStatus.FINALIZADA,
        Comanda.atualizada_em >= start,
        Comanda.atualizada_em < end
    )
    if user.role != Role.ADMIN:
        vend_stmt = vend_stmt.where(Comanda.id_vendedor == user.id)
    vend_stmt = vend_stmt.group_by(User.id, User.nome).order_by(func.coalesce(func.sum(Comanda.valor_total), 0).desc())

    vendedores = [
        {"id": vid, "nome": nome, "total": total}
        for vid, nome, total in db.execute(vend_stmt).all()
    ]

    comandas_out = []
    for c in comandas:
        vendedor = db.get(User, c.id_vendedor)
        comandas_out.append({
            "id": c.id,
            "mesa": c.mesa,
            "observacao": c.observacao,
            "vendedor_nome": vendedor.nome if vendedor else None,
            "valor_total": c.valor_total,
            "finalizada_em": c.atualizada_em,
        })

    return {
        "total_vendas": total_vendas,
        "produtos": produtos,
        "vendedores": vendedores,
        "comandas_finalizadas": comandas_out,
    }

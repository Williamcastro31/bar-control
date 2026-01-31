from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from datetime import timezone
from app.db.session import get_db
from app.core.security import require_vendedor, require_caixa
from app.models.models import Caixa, CaixaMov, CaixaStatus, CaixaMovTipo
from app.schemas.caixa import (
    CaixaOpenIn, CaixaCloseIn, CaixaMovIn, CaixaOut, CaixaMovOut,
    CaixaVendaIn, CaixaVendaLoteIn
)
from app.services.comanda_service import vender_balcao

router = APIRouter(prefix="/caixa", tags=["caixa"])
try:
    BR_TZ = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    BR_TZ = timezone(timedelta(hours=-3))

def _get_caixa_aberto(db: Session) -> Caixa | None:
    return db.execute(
        select(Caixa).where(Caixa.status == CaixaStatus.ABERTO)
    ).scalars().first()

def _get_caixa_ultimo(db: Session) -> Caixa | None:
    return db.execute(
        select(Caixa).order_by(Caixa.aberto_em.desc())
    ).scalars().first()

@router.get("/atual", response_model=CaixaOut | None)
def caixa_atual(db: Session = Depends(get_db), user=Depends(require_caixa)):
    return _get_caixa_aberto(db)

@router.post("/abrir", response_model=CaixaOut)
def abrir_caixa(payload: CaixaOpenIn, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    atual = _get_caixa_aberto(db)
    if atual:
        raise HTTPException(status_code=400, detail="Ja existe um caixa aberto.")
    now = datetime.now(BR_TZ)
    c = Caixa(
        status=CaixaStatus.ABERTO,
        saldo_inicial=payload.saldo_inicial,
        observacao=payload.observacao,
        aberto_em=now
    )
    db.add(c)
    db.flush()
    db.add(CaixaMov(
        id_caixa=c.id,
        tipo=CaixaMovTipo.ABERTURA,
        valor=payload.saldo_inicial,
        descricao=payload.observacao or "Abertura de caixa",
        criado_em=now
    ))
    db.commit()
    db.refresh(c)
    return c

@router.post("/fechar", response_model=CaixaOut)
def fechar_caixa(payload: CaixaCloseIn, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    atual = _get_caixa_aberto(db)
    if not atual:
        raise HTTPException(status_code=400, detail="Nao ha caixa aberto.")
    now = datetime.now(BR_TZ)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    total_vendido = db.execute(
        select(func.coalesce(func.sum(CaixaMov.valor), 0)).where(
            CaixaMov.id_caixa == atual.id,
            CaixaMov.tipo == CaixaMovTipo.VENDA,
            CaixaMov.criado_em >= start,
            CaixaMov.criado_em < end
        )
    ).scalar_one()

    atual.status = CaixaStatus.FECHADO
    atual.saldo_final = payload.saldo_final
    atual.observacao = payload.observacao or atual.observacao
    atual.fechado_em = now
    db.add(CaixaMov(
        id_caixa=atual.id,
        tipo=CaixaMovTipo.FECHAMENTO,
        valor=total_vendido,
        descricao=payload.observacao or "Fechamento de caixa",
        criado_em=now
    ))
    db.commit()
    db.refresh(atual)
    return atual

@router.post("/movimentos", response_model=CaixaMovOut)
def registrar_movimento(payload: CaixaMovIn, db: Session = Depends(get_db), user=Depends(require_vendedor)):
    atual = _get_caixa_aberto(db)
    if not atual:
        raise HTTPException(status_code=400, detail="Nao ha caixa aberto.")
    if payload.valor <= 0:
        raise HTTPException(status_code=400, detail="Valor invalido.")
    if payload.tipo not in ("VENDA", "REFORCO", "SANGRIA", "AJUSTE"):
        raise HTTPException(status_code=400, detail="Tipo invalido.")

    mov = CaixaMov(
        id_caixa=atual.id,
        tipo=CaixaMovTipo(payload.tipo),
        valor=payload.valor,
        descricao=payload.descricao,
        criado_em=datetime.now(BR_TZ)
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov

@router.post("/venda-balcao", response_model=CaixaMovOut)
def venda_balcao(payload: CaixaVendaIn, db: Session = Depends(get_db), user=Depends(require_caixa)):
    atual = _get_caixa_aberto(db)
    if not atual:
        raise HTTPException(status_code=400, detail="Nao ha caixa aberto.")

    try:
        total, nome = vender_balcao(db, payload.id_produto, payload.quantidade)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    mov = CaixaMov(
        id_caixa=atual.id,
        tipo=CaixaMovTipo.VENDA,
        valor=total,
        descricao=payload.descricao or f"Venda balcao {nome} x{payload.quantidade}",
        criado_em=datetime.now(BR_TZ)
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov

@router.post("/venda-balcao-lote", response_model=CaixaMovOut)
def venda_balcao_lote(payload: CaixaVendaLoteIn, db: Session = Depends(get_db), user=Depends(require_caixa)):
    atual = _get_caixa_aberto(db)
    if not atual:
        raise HTTPException(status_code=400, detail="Nao ha caixa aberto.")
    if not payload.itens:
        raise HTTPException(status_code=400, detail="Informe ao menos um item.")

    total = 0
    desc_parts = []
    try:
        for it in payload.itens:
            subtotal, nome = vender_balcao(db, it.id_produto, it.quantidade)
            total += subtotal
            desc_parts.append(f"{nome} x{it.quantidade}")
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    descricao = payload.descricao or "Venda balcao: " + ", ".join(desc_parts)
    troco = None
    if payload.pagamento_tipo == "DINHEIRO":
        if payload.valor_recebido is None:
            raise HTTPException(status_code=400, detail="Informe o valor recebido.")
        if payload.valor_recebido < total:
            raise HTTPException(status_code=400, detail="Valor recebido menor que o total.")
        troco = payload.valor_recebido - total

    mov = CaixaMov(
        id_caixa=atual.id,
        tipo=CaixaMovTipo.VENDA,
        valor=total,
        descricao=descricao,
        pagamento_tipo=payload.pagamento_tipo,
        valor_recebido=payload.valor_recebido,
        troco=troco,
        criado_em=datetime.now(BR_TZ)
    )
    db.add(mov)
    db.commit()
    db.refresh(mov)
    return mov

@router.get("/movimentos", response_model=list[CaixaMovOut])
def listar_movimentos(db: Session = Depends(get_db), user=Depends(require_vendedor)):
    atual = _get_caixa_aberto(db) or _get_caixa_ultimo(db)
    if not atual:
        return []
    return db.execute(
        select(CaixaMov).where(CaixaMov.id_caixa == atual.id).order_by(CaixaMov.criado_em.desc())
    ).scalars().all()

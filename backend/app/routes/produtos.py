from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.db.session import get_db
from app.core.security import require_admin, require_caixa
from decimal import Decimal
from app.models.models import Produto, ProdutoTipo, ProdutoComponente, MovEstoque, TipoMov
from app.schemas.produtos import (
    ProdutoCreate, ProdutoUpdate, ProdutoOut, ComponenteIn,
    EstoqueEntradaIn, EstoqueSaidaIn, MovEstoqueOut
)
from app.services.log_service import log_action
from app.services.produto_service import produto_to_display

router = APIRouter(prefix="/produtos", tags=["produtos"])

@router.get("", response_model=list[ProdutoOut])
@router.get("/", response_model=list[ProdutoOut])
def listar_produtos(db: Session = Depends(get_db), user=Depends(require_caixa)):
    produtos = db.execute(select(Produto).where(Produto.ativo == True)).scalars().all()
    return [produto_to_display(db, p) for p in produtos]

@router.post("", response_model=ProdutoOut)
@router.post("/", response_model=ProdutoOut)
def criar_produto(payload: ProdutoCreate, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    tipo = payload.tipo if payload.tipo in ("SIMPLES","COMBO") else "SIMPLES"
    p = Produto(
        nome=payload.nome,
        preco=payload.preco,
        estoque_atual=payload.estoque_atual,
        estoque_minimo=payload.estoque_minimo,
        tipo=ProdutoTipo(tipo),
        ativo=payload.ativo
    )
    db.add(p)
    log_action(db, admin.nome, "CRIAR_PRODUTO", f"{payload.nome} tipo={tipo}", request.client.host if request.client else None)
    db.commit()
    db.refresh(p)
    return produto_to_display(db, p)

@router.put("/{id_produto}", response_model=ProdutoOut)
def atualizar_produto(id_produto: int, payload: ProdutoUpdate, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    p = db.get(Produto, id_produto)
    if not p:
        raise HTTPException(404, "Produto não encontrado.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == "tipo" and v is not None:
            if v not in ("SIMPLES","COMBO"):
                raise HTTPException(400, "tipo inválido.")
            setattr(p, k, ProdutoTipo(v))
        else:
            setattr(p, k, v)
    log_action(db, admin.nome, "ATUALIZAR_PRODUTO", f"id={id_produto}", request.client.host if request.client else None)
    db.commit()
    db.refresh(p)
    return produto_to_display(db, p)

@router.post("/{id_combo}/componentes", response_model=dict)
def definir_componentes_combo(id_combo: int, comps: list[ComponenteIn], request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    combo = db.get(Produto, id_combo)
    if not combo:
        raise HTTPException(404, "Combo não encontrado.")
    if combo.tipo != ProdutoTipo.COMBO:
        raise HTTPException(400, "Produto não é do tipo COMBO.")

    # limpa existentes e recria
    db.execute(delete(ProdutoComponente).where(ProdutoComponente.id_produto_combo == id_combo))
    for c in comps:
        if c.quantidade <= 0:
            raise HTTPException(400, "quantidade do componente inválida.")
        comp_prod = db.get(Produto, c.id_produto_componente)
        if not comp_prod:
            raise HTTPException(404, f"Componente id={c.id_produto_componente} não encontrado.")
        if comp_prod.tipo != ProdutoTipo.SIMPLES:
            raise HTTPException(400, "Componente deve ser produto SIMPLES.")
        db.add(ProdutoComponente(
            id_produto_combo=id_combo,
            id_produto_componente=c.id_produto_componente,
            quantidade=c.quantidade
        ))

    log_action(db, admin.nome, "DEFINIR_COMPONENTES_COMBO", f"combo_id={id_combo} comps={len(comps)}", request.client.host if request.client else None)
    db.commit()
    return {"ok": True}

@router.post("/{id_produto}/entrada", response_model=dict)
def entrada_estoque(id_produto: int, payload: EstoqueEntradaIn, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if payload.quantidade <= 0:
        raise HTTPException(400, "quantidade invalida.")

    row = db.execute(
        select(Produto).where(Produto.id == id_produto).with_for_update()
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Produto nao encontrado.")
    if row.tipo != ProdutoTipo.SIMPLES:
        raise HTTPException(400, "Entrada de estoque permitida apenas para produto SIMPLES.")

    row.estoque_atual = Decimal(row.estoque_atual) + payload.quantidade
    db.add(MovEstoque(
        id_comanda=None,
        id_item_comanda=None,
        id_produto=row.id,
        tipo=TipoMov.ENTRADA,
        quantidade=payload.quantidade,
        detalhe=f"Entrada estoque data={payload.data_entrada} validade={payload.validade}"
    ))
    log_action(db, admin.nome, "ENTRADA_ESTOQUE", f"id_produto={row.id} qtd={payload.quantidade}", request.client.host if request.client else None)
    db.commit()
    return {"ok": True}

@router.post("/{id_produto}/saida", response_model=dict)
def saida_estoque(id_produto: int, payload: EstoqueSaidaIn, request: Request, db: Session = Depends(get_db), admin=Depends(require_admin)):
    if payload.quantidade <= 0:
        raise HTTPException(400, "quantidade invalida.")

    row = db.execute(
        select(Produto).where(Produto.id == id_produto).with_for_update()
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Produto nao encontrado.")
    if row.tipo != ProdutoTipo.SIMPLES:
        raise HTTPException(400, "Saida de estoque permitida apenas para produto SIMPLES.")
    if Decimal(row.estoque_atual) < payload.quantidade:
        raise HTTPException(400, "Estoque insuficiente para saida.")

    row.estoque_atual = Decimal(row.estoque_atual) - payload.quantidade
    db.add(MovEstoque(
        id_comanda=None,
        id_item_comanda=None,
        id_produto=row.id,
        tipo=TipoMov.BAIXA,
        quantidade=payload.quantidade,
        detalhe=payload.detalhe or f"Saida estoque data={payload.data_saida}"
    ))
    log_action(db, admin.nome, "SAIDA_ESTOQUE", f"id_produto={row.id} qtd={payload.quantidade}", request.client.host if request.client else None)
    db.commit()
    return {"ok": True}

@router.get("/movimentos", response_model=list[MovEstoqueOut])
def listar_movimentos(db: Session = Depends(get_db), admin=Depends(require_admin)):
    rows = db.execute(
        select(MovEstoque, Produto).join(Produto, Produto.id == MovEstoque.id_produto).order_by(MovEstoque.data_hora.desc())
    ).all()
    return [
        MovEstoqueOut(
            id=mov.id,
            id_produto=mov.id_produto,
            produto_nome=prod.nome,
            tipo=mov.tipo.value if hasattr(mov.tipo, "value") else mov.tipo,
            quantidade=mov.quantidade,
            data_hora=mov.data_hora,
            detalhe=mov.detalhe
        )
        for mov, prod in rows
    ]


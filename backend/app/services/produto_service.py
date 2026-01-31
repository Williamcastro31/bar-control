from sqlalchemy.orm import Session
from sqlalchemy import select, func
from decimal import Decimal
import math

from app.models.models import Produto, ProdutoTipo, ProdutoComponente, MovEstoque, TipoMov

def _saldo_from_movs(db: Session, produto_id: int, fallback: Decimal) -> Decimal:
    has_movs = db.execute(
        select(func.count()).where(MovEstoque.id_produto == produto_id)
    ).scalar_one()
    if not has_movs:
        return Decimal(fallback)

    entradas = db.execute(
        select(func.coalesce(func.sum(MovEstoque.quantidade), 0)).where(
            MovEstoque.id_produto == produto_id,
            MovEstoque.tipo.in_([TipoMov.ENTRADA, TipoMov.ESTORNO])
        )
    ).scalar_one()
    saidas = db.execute(
        select(func.coalesce(func.sum(MovEstoque.quantidade), 0)).where(
            MovEstoque.id_produto == produto_id,
            MovEstoque.tipo == TipoMov.BAIXA
        )
    ).scalar_one()
    return Decimal(entradas) - Decimal(saidas)

def calcular_disponibilidade_combo(db: Session, combo_id: int) -> tuple[int, str | None]:
    comps = db.execute(select(ProdutoComponente).where(ProdutoComponente.id_produto_combo == combo_id)).scalars().all()
    if not comps:
        return 0, "Combo sem componentes cadastrados"

    mins = []
    for c in comps:
        comp = db.get(Produto, c.id_produto_componente)
        if not comp or not comp.ativo:
            return 0, "Componente inválido/inativo"
        if Decimal(c.quantidade) <= 0:
            return 0, "Quantidade do componente inválida"
        saldo_comp = _saldo_from_movs(db, comp.id, comp.estoque_atual)
        possible = int(Decimal(saldo_comp) // Decimal(c.quantidade))
        mins.append(possible)

    return (min(mins) if mins else 0), None

def produto_to_display(db: Session, p: Produto) -> dict:
    saldo_atual = _saldo_from_movs(db, p.id, p.estoque_atual)
    data = {
        "id": p.id,
        "nome": p.nome,
        "preco": p.preco,
        "estoque_atual": p.estoque_atual,
        "saldo_atual": saldo_atual,
        "estoque_minimo": p.estoque_minimo,
        "tipo": p.tipo.value if hasattr(p.tipo, "value") else p.tipo,
        "ativo": p.ativo,
        "disponivel_combo": None,
        "can_add": True,
        "reason_disabled": None,
    }
    if data["tipo"] == "SIMPLES":
        if Decimal(saldo_atual) <= 0:
            data["can_add"] = False
            data["reason_disabled"] = "Sem estoque"
    else:
        disp, reason = calcular_disponibilidade_combo(db, p.id)
        data["disponivel_combo"] = disp
        if disp <= 0:
            data["can_add"] = False
            data["reason_disabled"] = reason or "Sem componentes suficientes"
    return data

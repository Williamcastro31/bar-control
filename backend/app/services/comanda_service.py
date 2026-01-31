from sqlalchemy import select, func
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.models import (
    Produto, ProdutoTipo, ProdutoComponente,
    Comanda, ComandaStatus, ItemComanda,
    MovEstoque, TipoMov
)

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

def add_item_comanda(db: Session, id_comanda: int, id_produto: int, qtd: Decimal):
    comanda = db.get(Comanda, id_comanda)
    if not comanda or comanda.status != ComandaStatus.ABERTA:
        raise ValueError("Comanda invÇ­lida ou nÇœo estÇ­ aberta.")

    produto = db.get(Produto, id_produto)
    if not produto or not produto.ativo:
        raise ValueError("Produto invÇ­lido/inativo.")

    if qtd <= 0:
        raise ValueError("Quantidade invÇ­lida.")

    if produto.tipo == ProdutoTipo.SIMPLES:
        row = db.execute(
            select(Produto).where(Produto.id == id_produto).with_for_update()
        ).scalar_one()

        saldo_atual = _saldo_from_movs(db, row.id, row.estoque_atual)
        if Decimal(saldo_atual) <= 0:
            raise ValueError("Produto sem estoque disponÇðvel.")
        if Decimal(saldo_atual) < qtd:
            raise ValueError("Quantidade solicitada maior que o estoque disponÇðvel.")

        preco = Decimal(produto.preco)
        total = (preco * qtd)

        item = ItemComanda(
            id_comanda=id_comanda,
            id_produto=id_produto,
            quantidade=qtd,
            preco_unitario=preco,
            total_item=total
        )
        db.add(item)

        row.estoque_atual = Decimal(row.estoque_atual) - qtd

        db.flush()
        db.add(MovEstoque(
            id_comanda=id_comanda,
            id_item_comanda=item.id,
            id_produto=id_produto,
            tipo=TipoMov.BAIXA,
            quantidade=qtd,
            detalhe="Venda produto simples"
        ))

        comanda.valor_total = Decimal(comanda.valor_total) + total

    else:
        comps = db.execute(
            select(ProdutoComponente).where(ProdutoComponente.id_produto_combo == id_produto)
        ).scalars().all()
        if not comps:
            raise ValueError("Combo sem componentes cadastrados.")

        comp_ids = sorted([c.id_produto_componente for c in comps])
        locked = db.execute(
            select(Produto).where(Produto.id.in_(comp_ids)).with_for_update()
        ).scalars().all()
        locked_map = {p.id: p for p in locked}

        for c in comps:
            comp = locked_map.get(c.id_produto_componente)
            need = Decimal(c.quantidade) * qtd
            saldo_comp = _saldo_from_movs(db, comp.id, comp.estoque_atual) if comp else Decimal(0)
            if not comp or not comp.ativo:
                raise ValueError("Componente invÇ­lido/inativo no combo.")
            if Decimal(saldo_comp) <= 0:
                raise ValueError(f"Sem estoque do componente: {comp.nome}")
            if Decimal(saldo_comp) < need:
                raise ValueError(f"Estoque insuficiente do componente: {comp.nome}")

        preco = Decimal(produto.preco)
        total = (preco * qtd)

        item = ItemComanda(
            id_comanda=id_comanda,
            id_produto=id_produto,
            quantidade=qtd,
            preco_unitario=preco,
            total_item=total
        )
        db.add(item)
        db.flush()

        for c in comps:
            comp = locked_map[c.id_produto_componente]
            need = Decimal(c.quantidade) * qtd
            comp.estoque_atual = Decimal(comp.estoque_atual) - need

            db.add(MovEstoque(
                id_comanda=id_comanda,
                id_item_comanda=item.id,
                id_produto=comp.id,
                tipo=TipoMov.BAIXA,
                quantidade=need,
                detalhe=f"Venda combo (item {produto.nome})"
            ))

        comanda.valor_total = Decimal(comanda.valor_total) + total

    return {"ok": True, "id_comanda": id_comanda}

def vender_balcao(db: Session, id_produto: int, qtd: Decimal) -> tuple[Decimal, str]:
    produto = db.get(Produto, id_produto)
    if not produto or not produto.ativo:
        raise ValueError("Produto invalido/inativo.")
    if qtd <= 0:
        raise ValueError("Quantidade invalida.")

    if produto.tipo == ProdutoTipo.SIMPLES:
        row = db.execute(
            select(Produto).where(Produto.id == id_produto).with_for_update()
        ).scalar_one()

        saldo_atual = _saldo_from_movs(db, row.id, row.estoque_atual)
        if Decimal(saldo_atual) <= 0:
            raise ValueError("Produto sem estoque disponivel.")
        if Decimal(saldo_atual) < qtd:
            raise ValueError("Quantidade solicitada maior que o estoque disponivel.")

        row.estoque_atual = Decimal(row.estoque_atual) - qtd
        total = Decimal(produto.preco) * qtd

        db.add(MovEstoque(
            id_comanda=None,
            id_item_comanda=None,
            id_produto=id_produto,
            tipo=TipoMov.BAIXA,
            quantidade=qtd,
            detalhe="Venda balcao"
        ))
        return total, produto.nome

    comps = db.execute(
        select(ProdutoComponente).where(ProdutoComponente.id_produto_combo == id_produto)
    ).scalars().all()
    if not comps:
        raise ValueError("Combo sem componentes cadastrados.")

    comp_ids = sorted([c.id_produto_componente for c in comps])
    locked = db.execute(
        select(Produto).where(Produto.id.in_(comp_ids)).with_for_update()
    ).scalars().all()
    locked_map = {p.id: p for p in locked}

    for c in comps:
        comp = locked_map.get(c.id_produto_componente)
        need = Decimal(c.quantidade) * qtd
        saldo_comp = _saldo_from_movs(db, comp.id, comp.estoque_atual) if comp else Decimal(0)
        if not comp or not comp.ativo:
            raise ValueError("Componente invalido/inativo no combo.")
        if Decimal(saldo_comp) <= 0:
            raise ValueError(f"Sem estoque do componente: {comp.nome}")
        if Decimal(saldo_comp) < need:
            raise ValueError(f"Estoque insuficiente do componente: {comp.nome}")

    total = Decimal(produto.preco) * qtd
    for c in comps:
        comp = locked_map[c.id_produto_componente]
        need = Decimal(c.quantidade) * qtd
        comp.estoque_atual = Decimal(comp.estoque_atual) - need

        db.add(MovEstoque(
            id_comanda=None,
            id_item_comanda=None,
            id_produto=comp.id,
            tipo=TipoMov.BAIXA,
            quantidade=need,
            detalhe=f"Venda balcao combo ({produto.nome})"
        ))
    return total, produto.nome

def remove_item_comanda(db: Session, item_id: int):
    item = db.get(ItemComanda, item_id)
    if not item:
        raise ValueError("Item nÇœo encontrado.")

    comanda = db.get(Comanda, item.id_comanda)
    if not comanda or comanda.status != ComandaStatus.ABERTA:
        raise ValueError("Comanda invÇ­lida ou nÇœo estÇ­ aberta.")

    produto = db.get(Produto, item.id_produto)
    if not produto:
        raise ValueError("Produto do item nÇœo encontrado.")

    qtd_item = Decimal(item.quantidade)
    total_item = Decimal(item.total_item)

    if produto.tipo == ProdutoTipo.SIMPLES:
        row = db.execute(select(Produto).where(Produto.id == produto.id).with_for_update()).scalar_one()
        row.estoque_atual = Decimal(row.estoque_atual) + qtd_item

        db.add(MovEstoque(
            id_comanda=comanda.id,
            id_item_comanda=item.id,
            id_produto=produto.id,
            tipo=TipoMov.ESTORNO,
            quantidade=qtd_item,
            detalhe="Estorno por remoÇõÇœo de item"
        ))
    else:
        comps = db.execute(select(ProdutoComponente).where(ProdutoComponente.id_produto_combo == produto.id)).scalars().all()
        comp_ids = sorted([c.id_produto_componente for c in comps])
        locked = db.execute(select(Produto).where(Produto.id.in_(comp_ids)).with_for_update()).scalars().all()
        locked_map = {p.id: p for p in locked}

        for c in comps:
            comp = locked_map.get(c.id_produto_componente)
            need = Decimal(c.quantidade) * qtd_item
            comp.estoque_atual = Decimal(comp.estoque_atual) + need
            db.add(MovEstoque(
                id_comanda=comanda.id,
                id_item_comanda=item.id,
                id_produto=comp.id,
                tipo=TipoMov.ESTORNO,
                quantidade=need,
                detalhe=f"Estorno por remoÇõÇœo de combo ({produto.nome})"
            ))

    # remove item + ajusta total
    comanda.valor_total = Decimal(comanda.valor_total) - total_item
    db.delete(item)

def cancel_comanda(db: Session, id_comanda: int):
    comanda = db.get(Comanda, id_comanda)
    if not comanda or comanda.status != ComandaStatus.ABERTA:
        raise ValueError("Comanda invÇ­lida ou nÇœo estÇ­ aberta.")

    itens = db.execute(select(ItemComanda).where(ItemComanda.id_comanda == id_comanda)).scalars().all()
    for it in itens:
        remove_item_comanda(db, it.id)

    comanda.status = ComandaStatus.CANCELADA

def finalizar_comanda(db: Session, id_comanda: int):
    comanda = db.get(Comanda, id_comanda)
    if not comanda or comanda.status != ComandaStatus.ABERTA:
        raise ValueError("Comanda invÇ­lida ou nÇœo estÇ­ aberta.")
    comanda.status = ComandaStatus.FINALIZADA

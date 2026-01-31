from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
from datetime import date, datetime

class ProdutoCreate(BaseModel):
    nome: str
    preco: Decimal = 0
    estoque_atual: Decimal = 0
    estoque_minimo: Decimal = 0
    tipo: str = "SIMPLES"  # SIMPLES | COMBO
    ativo: bool = True

class ProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    preco: Optional[Decimal] = None
    estoque_atual: Optional[Decimal] = None
    estoque_minimo: Optional[Decimal] = None
    tipo: Optional[str] = None
    ativo: Optional[bool] = None

class ComponenteIn(BaseModel):
    id_produto_componente: int
    quantidade: Decimal

class ProdutoOut(BaseModel):
    id: int
    nome: str
    preco: Decimal
    estoque_atual: Decimal
    saldo_atual: Optional[Decimal] = None
    estoque_minimo: Decimal
    tipo: str
    ativo: bool

    # Para combos (calculado no backend)
    disponivel_combo: Optional[int] = None
    can_add: Optional[bool] = None
    reason_disabled: Optional[str] = None

    class Config:
        from_attributes = True

class EstoqueEntradaIn(BaseModel):
    quantidade: Decimal
    data_entrada: date
    validade: date

class EstoqueSaidaIn(BaseModel):
    quantidade: Decimal
    data_saida: date
    detalhe: Optional[str] = None

class MovEstoqueOut(BaseModel):
    id: int
    id_produto: int
    produto_nome: str
    tipo: str
    quantidade: Decimal
    data_hora: Optional[datetime]
    detalhe: Optional[str] = None

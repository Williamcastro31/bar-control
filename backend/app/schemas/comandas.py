from pydantic import BaseModel
from decimal import Decimal
from typing import List, Optional

class ComandaCreate(BaseModel):
    id_vendedor: Optional[int] = None
    mesa: Optional[str] = None
    observacao: Optional[str] = None

class ComandaOut(BaseModel):
    id: int
    id_vendedor: int
    mesa: Optional[str] = None
    observacao: Optional[str] = None
    vendedor_nome: Optional[str] = None
    status: str
    valor_total: Decimal

    class Config:
        from_attributes = True

class AddItemIn(BaseModel):
    id_produto: int
    quantidade: Decimal = 1

class ItemOut(BaseModel):
    id: int
    id_comanda: int
    id_produto: int
    quantidade: Decimal
    preco_unitario: Decimal
    total_item: Decimal

    class Config:
        from_attributes = True

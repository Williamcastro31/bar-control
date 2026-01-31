from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import datetime

class CaixaOpenIn(BaseModel):
    saldo_inicial: Decimal = 0
    observacao: Optional[str] = None

class CaixaCloseIn(BaseModel):
    saldo_final: Decimal
    observacao: Optional[str] = None

class CaixaMovIn(BaseModel):
    tipo: str  # VENDA | REFORCO | SANGRIA | AJUSTE
    valor: Decimal
    descricao: Optional[str] = None

class CaixaVendaIn(BaseModel):
    id_produto: int
    quantidade: Decimal = 1
    descricao: Optional[str] = None

class CaixaVendaItemIn(BaseModel):
    id_produto: int
    quantidade: Decimal = 1

class CaixaVendaLoteIn(BaseModel):
    itens: list[CaixaVendaItemIn]
    descricao: Optional[str] = None
    pagamento_tipo: str  # DINHEIRO | CARTAO
    valor_recebido: Optional[Decimal] = None

class CaixaOut(BaseModel):
    id: int
    status: str
    saldo_inicial: Decimal
    saldo_final: Optional[Decimal] = None
    observacao: Optional[str] = None
    aberto_em: datetime
    fechado_em: Optional[datetime] = None

    class Config:
        from_attributes = True

class CaixaMovOut(BaseModel):
    id: int
    id_caixa: int
    tipo: str
    valor: Decimal
    descricao: Optional[str] = None
    criado_em: datetime

    class Config:
        from_attributes = True

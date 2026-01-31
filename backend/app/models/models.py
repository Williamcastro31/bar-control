import enum
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Numeric, Boolean, Index
from sqlalchemy.orm import relationship
from app.db.session import Base

try:
    BR_TZ = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    BR_TZ = timezone(timedelta(hours=-3))

def now_br():
    return datetime.now(BR_TZ)

class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    VENDEDOR = "VENDEDOR"
    CAIXA = "CAIXA"

class ProdutoTipo(str, enum.Enum):
    SIMPLES = "SIMPLES"
    COMBO = "COMBO"

class ComandaStatus(str, enum.Enum):
    ABERTA = "ABERTA"
    FINALIZADA = "FINALIZADA"
    CANCELADA = "CANCELADA"

class TipoMov(str, enum.Enum):
    BAIXA = "BAIXA"
    ESTORNO = "ESTORNO"
    ENTRADA = "ENTRADA"

class CaixaStatus(str, enum.Enum):
    ABERTO = "ABERTO"
    FECHADO = "FECHADO"

class CaixaMovTipo(str, enum.Enum):
    VENDA = "VENDA"
    REFORCO = "REFORCO"
    SANGRIA = "SANGRIA"
    AJUSTE = "AJUSTE"
    ABERTURA = "ABERTURA"
    FECHAMENTO = "FECHAMENTO"

class PagamentoTipo(str, enum.Enum):
    DINHEIRO = "DINHEIRO"
    CARTAO = "CARTAO"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    nome = Column(String(120), nullable=False)
    username = Column(String(80), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(Role), nullable=False, default=Role.VENDEDOR)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=now_br)

class Produto(Base):
    __tablename__ = "produtos"
    id = Column(Integer, primary_key=True)
    nome = Column(String(200), nullable=False)
    preco = Column(Numeric(10, 2), nullable=False, default=0)
    estoque_atual = Column(Numeric(12, 3), nullable=False, default=0)  # permite fracionado (doses)
    estoque_minimo = Column(Numeric(12, 3), nullable=False, default=0)
    tipo = Column(Enum(ProdutoTipo), nullable=False, default=ProdutoTipo.SIMPLES)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=now_br)
    atualizado_em = Column(DateTime, default=now_br, onupdate=now_br)

    componentes = relationship(
        "ProdutoComponente",
        foreign_keys="ProdutoComponente.id_produto_combo",
        cascade="all, delete-orphan"
    )

class ProdutoComponente(Base):
    __tablename__ = "produtos_componentes"
    id = Column(Integer, primary_key=True)
    id_produto_combo = Column(Integer, ForeignKey("produtos.id"), nullable=False, index=True)
    id_produto_componente = Column(Integer, ForeignKey("produtos.id"), nullable=False, index=True)
    quantidade = Column(Numeric(12, 3), nullable=False)

    __table_args__ = (
        Index("ix_combo_component_unique", "id_produto_combo", "id_produto_componente", unique=True),
    )

class Mesa(Base):
    __tablename__ = "mesas"
    id = Column(Integer, primary_key=True)
    numero = Column(String(20), nullable=False, unique=True, index=True)
    descricao = Column(String(200), nullable=True)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=now_br)

class Caixa(Base):
    __tablename__ = "caixas"
    id = Column(Integer, primary_key=True)
    status = Column(Enum(CaixaStatus), nullable=False, default=CaixaStatus.ABERTO, index=True)
    saldo_inicial = Column(Numeric(12, 2), nullable=False, default=0)
    saldo_final = Column(Numeric(12, 2), nullable=True)
    observacao = Column(String(255), nullable=True)
    aberto_em = Column(DateTime, default=now_br, index=True)
    fechado_em = Column(DateTime, nullable=True, index=True)

class CaixaMov(Base):
    __tablename__ = "caixa_movimentos"
    id = Column(Integer, primary_key=True)
    id_caixa = Column(Integer, ForeignKey("caixas.id"), nullable=False, index=True)
    tipo = Column(Enum(CaixaMovTipo), nullable=False)
    valor = Column(Numeric(12, 2), nullable=False)
    descricao = Column(String(255), nullable=True)
    pagamento_tipo = Column(Enum(PagamentoTipo), nullable=True)
    valor_recebido = Column(Numeric(12, 2), nullable=True)
    troco = Column(Numeric(12, 2), nullable=True)
    criado_em = Column(DateTime, default=now_br, index=True)

class Comanda(Base):
    __tablename__ = "comandas"
    id = Column(Integer, primary_key=True)  # número sequencial
    id_vendedor = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mesa = Column(String(20), nullable=True)
    observacao = Column(String(255), nullable=True)
    status = Column(Enum(ComandaStatus), nullable=False, default=ComandaStatus.ABERTA, index=True)
    valor_total = Column(Numeric(12, 2), nullable=False, default=0)
    criada_em = Column(DateTime, default=now_br)
    atualizada_em = Column(DateTime, default=now_br, onupdate=now_br)

class ItemComanda(Base):
    __tablename__ = "itens_comanda"
    id = Column(Integer, primary_key=True)
    id_comanda = Column(Integer, ForeignKey("comandas.id"), nullable=False, index=True)
    id_produto = Column(Integer, ForeignKey("produtos.id"), nullable=False, index=True)
    quantidade = Column(Numeric(12, 3), nullable=False, default=1)
    preco_unitario = Column(Numeric(10, 2), nullable=False, default=0)
    total_item = Column(Numeric(12, 2), nullable=False, default=0)
    criado_em = Column(DateTime, default=now_br)

class MovEstoque(Base):
    __tablename__ = "mov_estoque"
    id = Column(Integer, primary_key=True)
    id_comanda = Column(Integer, ForeignKey("comandas.id"), nullable=True, index=True)
    id_item_comanda = Column(Integer, ForeignKey("itens_comanda.id"), nullable=True, index=True)
    id_produto = Column(Integer, ForeignKey("produtos.id"), nullable=False, index=True)
    tipo = Column(Enum(TipoMov), nullable=False)
    quantidade = Column(Numeric(12, 3), nullable=False)
    data_hora = Column(DateTime, default=now_br, index=True)
    detalhe = Column(String(255), nullable=True)

class LogAcao(Base):
    __tablename__ = "logs"
    id = Column(Integer, primary_key=True)
    usuario = Column(String(120), nullable=False, index=True)
    acao = Column(String(120), nullable=False, index=True)
    detalhe = Column(String(500), nullable=True)
    ip = Column(String(64), nullable=True)
    data_hora = Column(DateTime, default=now_br, index=True)



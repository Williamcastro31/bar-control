from pydantic import BaseModel
from typing import Optional

class MesaCreate(BaseModel):
    numero: str
    descricao: Optional[str] = None
    ativo: bool = True

class MesaOut(BaseModel):
    id: int
    numero: str
    descricao: Optional[str] = None
    ativo: bool

    class Config:
        from_attributes = True

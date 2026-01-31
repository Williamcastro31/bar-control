from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class LogOut(BaseModel):
    id: int
    usuario: str
    acao: str
    detalhe: Optional[str] = None
    ip: Optional[str] = None
    data_hora: datetime

    class Config:
        from_attributes = True

from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    nome: str
    username: str
    password: str
    role: str = "VENDEDOR"

class UserUpdate(BaseModel):
    nome: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    ativo: Optional[bool] = None

class UserOut(BaseModel):
    id: int
    nome: str
    username: str
    role: str
    ativo: bool

    class Config:
        from_attributes = True

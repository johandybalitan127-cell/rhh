"""
Rutas de Autenticación (/api/auth)
Maneja el inicio de sesión y obtención de datos del usuario autenticado.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.database.connection import get_db
from backend.database.models import Colaborador
from backend.services.auth_service import (
    verificar_password, crear_access_token, obtener_colaborador_actual
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    cedula: str
    nombre_completo: str
    email: str
    puesto: str
    departamento: str
    rol: str
    modalidad: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

@router.post("/login", response_model=LoginResponse)
def login(credenciales: LoginRequest, db: Session = Depends(get_db)):
    """
    Inicia sesión y genera un token JWT.
    """
    colaborador = db.query(Colaborador).filter(Colaborador.email == credenciales.email).first()
    if not colaborador:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos."
        )

    if not verificar_password(credenciales.password, colaborador.contrasena_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos."
        )

    if colaborador.estado == "inactivo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su cuenta se encuentra inactiva. Contacte a Recursos Humanos."
        )

    # Crear token con el ID del colaborador como subject
    token = crear_access_token(data={"sub": str(colaborador.id), "rol": colaborador.rol})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": colaborador.id,
            "cedula": colaborador.cedula,
            "nombre_completo": colaborador.nombre_completo,
            "email": colaborador.email,
            "puesto": colaborador.puesto,
            "departamento": colaborador.departamento,
            "rol": colaborador.rol,
            "modalidad": colaborador.modalidad
        }
    }

@router.get("/me", response_model=UserResponse)
def get_mi_perfil(colaborador: Colaborador = Depends(obtener_colaborador_actual)):
    """
    Retorna los datos del usuario en sesión actual.
    """
    return {
        "id": colaborador.id,
        "cedula": colaborador.cedula,
        "nombre_completo": colaborador.nombre_completo,
        "email": colaborador.email,
        "puesto": colaborador.puesto,
        "departamento": colaborador.departamento,
        "rol": colaborador.rol,
        "modalidad": colaborador.modalidad
    }


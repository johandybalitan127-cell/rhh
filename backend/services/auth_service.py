"""
Servicio de Autenticación, Hashing y Autorización por Roles
Maneja contraseñas seguras con bcrypt y tokens JWT.
"""

import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, List
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.config import settings
from backend.database.connection import get_db
from backend.database.models import Colaborador

# Esquema de autenticación Bearer Token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    """Genera hash seguro con bcrypt nativo"""
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")

def verificar_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña ingresada coincide con el hash"""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        # Si fue almacenado en texto plano o formato alternativo
        return plain_password == hashed_password

def crear_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un token JWT firmado con expiración"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def obtener_colaborador_actual(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> Colaborador:
    """
    Dependencia de FastAPI: extrae y valida el usuario a partir del token JWT.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales de autenticación no válidas o expiradas.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        colaborador_id: str = payload.get("sub")
        if colaborador_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    colaborador = db.query(Colaborador).filter(Colaborador.id == int(colaborador_id)).first()
    if colaborador is None:
        raise credentials_exception

    if colaborador.estado == "inactivo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Cuenta de colaborador inactiva en el sistema."
        )

    return colaborador

def requerir_roles(roles_permitidos: List[str]):
    """
    Generador de dependencias para restringir endpoints según roles específicos.
    Ejemplo: @app.get('/admin', dependencies=[Depends(requerir_roles(['rrhh', 'administrador']))])
    """
    def validador_rol(colaborador: Colaborador = Depends(obtener_colaborador_actual)):
        if colaborador.rol not in roles_permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado: su rol '{colaborador.rol}' no tiene permisos para esta acción. Requerido: {roles_permitidos}."
            )
        return colaborador
    return validador_rol


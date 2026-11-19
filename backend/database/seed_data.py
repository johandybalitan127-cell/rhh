"""
Script de Semilla de Datos (Seed Data)
Mini Proyecto #2 - Portal de RRHH con RAG Multiagente (Costa Rica)
Genera 50 colaboradores costarricenses, 3 meses de movimientos, saldos de vacaciones,
solicitudes, incapacidades, chats y reporte diario de muestra.
"""

import os
import random
import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from backend.database.connection import SessionLocal, engine, Base
from backend.services.auth_service import hash_password
from backend.database.models import (
    Colaborador, SaldoVacaciones, Solicitud, 
    Incapacidad, MovimientoPersonal, ConsultaChat, ReporteDiario
)

DEFAULT_HASHED_PASSWORD = hash_password("Password123!")

# Nombres y Apellidos típicos de Costa Rica
NOMBRES_HOMBRES = [
    "Carlos", "Alejandro", "José", "Esteban", "Andrés", "Diego", "Mauricio", 
    "Fabián", "Luis", "Jorge", "Gabriel", "David", "Alonso", "Javier", "Manuel", 
    "Rolando", "Álvaro", "Rodrigo", "Ignacio", "Bryan", "Kevin", "Eduardo"
]

NOMBRES_MUJERES = [
    "María", "Valeria", "Sofía", "Andrea", "Daniela", "Camila", "Natalia", 
    "Lucía", "Jimena", "Adriana", "Paola", "Mariana", "Elena", "Carolina", 
    "Gabriela", "Laura", "Monserrat", "Fernanda", "Fiorella", "Melissa"
]

APELLIDOS = [
    "Rodríguez", "González", "Jiménez", "Mora", "Hernández", "Sánchez", 
    "Ramírez", "Castro", "Vargas", "Monge", "Solano", "Chaves", "Brenes", 
    "Quesada", "Rojas", "Navarro", "Guzmán", "Campos", "Araya", "Carvajal", 
    "Alvarado", "Cordero", "Picado", "Pérez", "Calderón", "Umaña", "Valverde"
]

DEPARTAMENTOS = [
    ("Tecnología", ["Desarrollador Full Stack Senior", "Desarrollador Frontend", "Desarrollador Backend", "Ingeniero DevOps", "QA Automation Engineer", "Arquitecto Cloud", "Especialista en Ciberseguridad", "Soporte Técnico TI"]),
    ("Recursos Humanos", ["Gerente de Talento Humano", "Generalista de RRHH", "Especialista en Reclutamiento", "Coordinador de Capacitación", "Analista de Nómina y Compensación"]),
    ("Finanzas", ["Director Financiero", "Contador General", "Analista Financiero", "Especialista en Cuentas por Cobrar", "Tesorero"]),
    ("Operaciones", ["Director de Operaciones", "Coordinador de Logística", "Gestor de Procesos", "Analista de Mejora Continua"]),
    ("Ventas y Mercadeo", ["Gerente Comercial", "Ejecutivo de Cuentas Clave", "Especialista en Marketing Digital", "Representante de Ventas B2B"]),
    ("Servicio al Cliente", ["Líder de Soporte al Cliente", "Agente de Servicio Senior", "Agente de Servicio Bilingüe"])
]

def generar_cedula_cr(indice: int) -> str:
    """Genera una cédula costarricense válida en formato X-XXXX-XXXX"""
    provincia = (indice % 7) + 1 # 1 San José, 2 Alajuela, 3 Cartago, 4 Heredia, 5 Guanacaste, 6 Puntarenas, 7 Limón
    tomo = str(random.randint(1000, 1999))
    asiento = str(random.randint(100, 999)).zfill(4)
    return f"{provincia}-{tomo}-{asiento}"

def generar_datos_completos():
    db = SessionLocal()
    try:
        print("-> Verificando tablas en la base de datos...")
        Base.metadata.create_all(bind=engine)

        # Si ya existen colaboradores, no duplicar
        existentes = db.query(Colaborador).count()
        if existentes >= 50:
            print(f"-> Ya existen {existentes} colaboradores en la base de datos. Saltando semilla.")
            return

        print("-> Generando 50 colaboradores de Costa Rica...")
        hoy = datetime.date.today()
        hace_90_dias = hoy - datetime.timedelta(days=90)

        colaboradores_creados = []

        # 1. Asegurar usuarios clave: 1 Administrador/RRHH y 1 Colaborador estándar conocido
        admin_rrhh = Colaborador(
            cedula="1-1122-0334",
            nombre_completo="Johandy Balitan",
            email="mchaves@tecnocr.com",
            contrasena_hash=DEFAULT_HASHED_PASSWORD,
            puesto="Gerente de Talento Humano",
            departamento="Recursos Humanos",
            fecha_ingreso=datetime.date(2021, 3, 1),
            salario_bruto=Decimal("2200000.00"),
            rol="rrhh",
            estado="activo",
            modalidad="hibrido",
            telefono="8877-6655",
            fecha_nacimiento=datetime.date(1986, 5, 14)
        )
        db.add(admin_rrhh)
        db.flush()
        colaboradores_creados.append(admin_rrhh)

        colaborador_test = Colaborador(
            cedula="1-1589-0412",
            nombre_completo="Carlos Jiménez Alvarado",
            email="cjimenez@tecnocr.com",
            contrasena_hash=DEFAULT_HASHED_PASSWORD,
            puesto="Desarrollador Full Stack Senior",
            departamento="Tecnología",
            fecha_ingreso=datetime.date(2022, 6, 15),
            salario_bruto=Decimal("1750000.00"),
            rol="colaborador",
            estado="activo",
            modalidad="remoto",
            supervisor_id=admin_rrhh.id,
            telefono="8344-9911",
            fecha_nacimiento=datetime.date(1992, 11, 22)
        )
        db.add(colaborador_test)
        db.flush()
        colaboradores_creados.append(colaborador_test)

        # 2. Generar los 48 colaboradores restantes
        for i in range(3, 51):
            es_mujer = (i % 2 == 0)
            nombre = random.choice(NOMBRES_MUJERES if es_mujer else NOMBRES_HOMBRES)
            ap1 = random.choice(APELLIDOS)
            ap2 = random.choice([a for a in APELLIDOS if a != ap1])
            nombre_completo = f"{nombre} {ap1} {ap2}"
            
            # Username / Email único
            username = f"{nombre[0].lower()}{ap1.lower()}{i}"
            email = f"{username}@tecnocr.com"
            cedula = generar_cedula_cr(i)

            depto_tupla = random.choice(DEPARTAMENTOS)
            departamento = depto_tupla[0]
            puesto = random.choice(depto_tupla[1])

            # Salarios en colones costarricenses (según perfil)
            salario = Decimal(str(random.randint(650, 2400) * 1000))

            # Antigüedad
            dias_antiguedad = random.randint(120, 1800)
            fecha_ingreso = hoy - datetime.timedelta(days=dias_antiguedad)

            # Rol
            rol = "rrhh" if departamento == "Recursos Humanos" else "colaborador"

            # Estado (algunos incapacitados y en vacaciones para reflejar estadísticas)
            estado = "activo"
            if i in [15, 28]:
                estado = "incapacitado"
            elif i in [22, 40]:
                estado = "vacaciones"
            elif i == 49:
                estado = "inactivo"

            modalidad = random.choice(["remoto", "hibrido", "presencial"])
            tel = f"{random.choice(['8', '7', '6'])}{random.randint(100, 999)}-{random.randint(1000, 9999)}"

            c = Colaborador(
                cedula=cedula,
                nombre_completo=nombre_completo,
                email=email,
                contrasena_hash=DEFAULT_HASHED_PASSWORD,
                puesto=puesto,
                departamento=departamento,
                fecha_ingreso=fecha_ingreso,
                salario_bruto=salario,
                rol=rol,
                estado=estado,
                modalidad=modalidad,
                supervisor_id=admin_rrhh.id if departamento != "Recursos Humanos" else None,
                telefono=tel,
                fecha_nacimiento=datetime.date(1975 + (i % 25), (i % 12) + 1, (i % 27) + 1)
            )
            db.add(c)
            db.flush()
            colaboradores_creados.append(c)

        print(f"-> 50 Colaboradores creados exitosamente.")

        # 3. Generar Saldos de Vacaciones
        print("-> Generando saldos de vacaciones (incluyendo >20 días acumulados para reportes)...")
        for idx, colab in enumerate(colaboradores_creados):
            # Algunos con más de 20 días acumulados (ej: idx 5, 12, 19, 31)
            if idx in [5, 12, 19, 31]:
                dias_pendientes = Decimal(str(random.randint(21, 28)))
                dias_acumulados = Decimal("14.00")
                dias_ganados = dias_pendientes
                dias_disfrutados = Decimal("0.00")
            else:
                dias_ganados = Decimal("14.00")
                dias_disfrutados = Decimal(str(random.randint(2, 10)))
                dias_acumulados = Decimal(str(random.randint(0, 4)))
                dias_pendientes = (dias_ganados + dias_acumulados) - dias_disfrutados

            saldo = SaldoVacaciones(
                colaborador_id=colab.id,
                periodo_anual="2025-2026",
                dias_ganados=dias_ganados,
                dias_disfrutados=dias_disfrutados,
                dias_pendientes=dias_pendientes,
                dias_acumulados_anteriores=dias_acumulados
            )
            db.add(saldo)

        # 4. Generar Solicitudes (incluyendo pendientes y críticas > 3 días)
        print("-> Generando solicitudes de permisos y vacaciones...")
        for colab in colaboradores_creados[:25]:
            # Solicitudes pendientes antiguas (> 3 días)
            dias_atras = random.randint(1, 15)
            f_solicitud = datetime.datetime.now() - datetime.timedelta(days=dias_atras)
            
            estado_sol = "pendiente" if dias_atras <= 6 else random.choice(["aprobada", "rechazada"])
            
            sol = Solicitud(
                colaborador_id=colab.id,
                tipo=random.choice(["vacaciones", "permiso_con_goce", "cambio_modalidad"]),
                fecha_inicio=hoy + datetime.timedelta(days=random.randint(5, 20)),
                fecha_fin=hoy + datetime.timedelta(days=random.randint(21, 25)),
                dias_solicitados=Decimal(str(random.randint(2, 5))),
                motivo="Vacaciones familiares de descanso anual programado en Costa Rica.",
                estado=estado_sol,
                fecha_solicitud=f_solicitud,
                revisado_por=admin_rrhh.id if estado_sol != "pendiente" else None,
                fecha_resolucion=f_solicitud + datetime.timedelta(days=1) if estado_sol != "pendiente" else None,
                observaciones_aprobador="Aprobado conforme al cronograma de la gerencia." if estado_sol == "aprobada" else None
            )
            db.add(sol)

        # 5. Generar Incapacidades (CCSS e INS)
        print("-> Generando incapacidades registradas (CCSS / INS)...")
        colab_incapacitados = [c for c in colaboradores_creados if c.estado == "incapacitado"] + colaboradores_creados[8:12]
        for idx, colab in enumerate(colab_incapacitados):
            es_activa = (colab.estado == "incapacitado")
            entidad = "CCSS" if idx % 2 == 0 else "INS"
            dias = random.randint(3, 15)
            f_ini = hoy - datetime.timedelta(days=random.randint(2, 5)) if es_activa else hoy - datetime.timedelta(days=40)
            f_fin = f_ini + datetime.timedelta(days=dias)

            incap = Incapacidad(
                colaborador_id=colab.id,
                entidad_emisora=entidad,
                codigo_boleta=f"BOL-{entidad}-2026-{1000 + idx}",
                fecha_inicio=f_ini,
                fecha_fin=f_fin,
                dias_totales=dias,
                diagnostico="Cuadro respiratorio agudo" if entidad == "CCSS" else "Esguince de tobillo en desplazamiento laboral",
                subsidio_porcentaje=Decimal("60.00"),
                estado="activa" if es_activa else "finalizada"
            )
            db.add(incap)

        # 6. Generar Movimientos de Personal de los últimos 3 meses
        print("-> Generando 3 meses de movimientos históricos de personal...")
        tipos_mov = [
            ("ingreso", "Contratación de nuevo talento costarricense."),
            ("promocion", "Promoción a nivel Senior por evaluación de desempeño sobresaliente."),
            ("ajuste_salarial", "Ajuste por costo de vida e inflación semestral."),
            ("cambio_departamento", "Movimiento horizontal a Tecnología."),
            ("salida_renuncia", "Renuncia voluntaria por motivos personales con aviso previo.")
        ]

        for i in range(15):
            colab = random.choice(colaboradores_creados)
            tipo, detalle = random.choice(tipos_mov)
            f_mov = hoy - datetime.timedelta(days=random.randint(5, 85))

            mov = MovimientoPersonal(
                colaborador_id=colab.id,
                tipo_movimiento=tipo,
                fecha_movimiento=f_mov,
                detalle=f"{detalle} Colaborador: {colab.nombre_completo}",
                departamento_anterior=colab.departamento,
                departamento_nuevo=colab.departamento,
                salario_anterior=colab.salario_bruto - Decimal("100000.00") if tipo in ["promocion", "ajuste_salarial"] else colab.salario_bruto,
                salario_nuevo=colab.salario_bruto,
                registrado_por=admin_rrhh.id
            )
            db.add(mov)

        # 7. Registrar Consultas de Chat de Muestra
        print("-> Generando consultas de chat históricas...")
        consultas_ejemplo = [
            ("¿Cuántos días de vacaciones tengo disponibles este año?", "politicas_rag", True, [{"documento": "Política de vacaciones y feriados", "seccion": "Artículo 153"}]),
            ("¿Cómo se calcula el aguinaldo según la ley de Costa Rica?", "politicas_rag", True, [{"documento": "Política salarial y calendario de pagos", "seccion": "Sección 4. Pago de Aguinaldo"}]),
            ("¿Cuál es el procedimiento para reportar una incapacidad de la CCSS?", "politicas_rag", True, [{"documento": "Procedimiento de incapacidades", "seccion": "Sección 2. Notificación en 48 horas"}]),
            ("¿Cuánto gana mi compañero de trabajo en Finanzas?", "bloqueo_seguridad", False, []),
            ("¿Cuál es la receta del gallo pinto tradicional?", "rechazado_fuera_de_ambito", False, [])
        ]

        for msg, agente, exitosa, fuentes in consultas_ejemplo:
            chat = ConsultaChat(
                colaborador_id=colaborador_test.id,
                sesion_id="sesion-demo-inicial-001",
                mensaje_usuario=msg,
                respuesta_agente="Respuesta generada de prueba por el agente de RRHH.",
                agente_resolutor=agente,
                resolucion_exitosa=exitosa,
                fuentes_citadas=fuentes,
                duracion_ms=random.randint(800, 2200)
            )
            db.add(chat)

        # 8. Reporte Diario Inicial de las 7:00 AM
        print("-> Generando reporte analítico diario inicial...")
        reporte_demo = ReporteDiario(
            fecha_reporte=hoy,
            hora_generacion="07:00:00",
            total_ausencias=4,
            solicitudes_pendientes=8,
            solicitudes_pendientes_criticas=3,
            incapacidades_activas=2,
            ingresos_mes=3,
            salidas_mes=1,
            colaboradores_vacaciones_acumuladas=4,
            total_consultas_chat=45,
            tasa_resolucion_pct=Decimal("91.50"),
            top_temas_consultados=[
                {"tema": "Vacaciones y feriados de ley", "consultas": 18},
                {"tema": "Incapacidades CCSS", "consultas": 11},
                {"tema": "Fechas de pago y aguinaldo", "consultas": 7},
                {"tema": "Teletrabajo y horarios", "consultas": 5},
                {"tema": "Beneficios médicos privados", "consultas": 4}
            ],
            preguntas_sin_respuesta=[
                {"pregunta": "¿Hay convenio de descuento en gimnasio Multiplaza?", "frecuencia": 2}
            ],
            resumen_ejecutivo=(
                "Resumen Ejecutivo RRHH - TecnoCR Soluciones S.A.: Al día de hoy se registran 4 ausencias activas, "
                "incluyendo 2 colaboradores incapacitados por CCSS/INS. Se mantienen 8 solicitudes pendientes de aprobación, "
                "de las cuales 3 superan el umbral crítico de 3 días de espera. Se alerta sobre 4 colaboradores con acumulación "
                "superior a 20 días de vacaciones, recomendando coordinar su disfrute para evitar pasivos laborales según el "
                "Código de Trabajo de Costa Rica. El chatbot registra un 91.5% de efectividad en consultas resueltas."
            ),
            datos_analiticos_sql={
                "departamentos_con_ausencias": ["Tecnología", "Operaciones"],
                "incapacidades_por_entidad": {"CCSS": 1, "INS": 1}
            }
        )
        db.add(reporte_demo)

        db.commit()
        print("-> ¡Semilla de datos completada con éxito en PostgreSQL!")

    except Exception as e:
        db.rollback()
        print(f"Error durante la generación de semilla: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    generar_datos_completos()

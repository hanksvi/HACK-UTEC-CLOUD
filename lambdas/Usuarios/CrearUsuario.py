import boto3
import hashlib
import uuid
import re
import json
import os
from lambdas.utils import response

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

ROLES_VALIDOS = ["Estudiante", "Personal administrativo", "Autoridad"]

def lambda_handler(event, context):
    dynamodb = boto3.resource('dynamodb')
    table_name = os.environ["USERS_TABLE"]
    table = dynamodb.Table(table_name)

    try:
        # Obtener y parsear el body
        body = event.get("body")

        # API Gateway envía el body como string
        if isinstance(body, str):
            body = json.loads(body)

        # Si sigue sin ser dict → error
        if not isinstance(body, dict):
            return response(400, {"message": "El body debe ser un JSON válido"})

        # Validar campos obligatorios correctamente
        campos_requeridos = ["nombres", "apellidos", "dni", "correo", "password", "rol"]
        for campo in campos_requeridos:
            if not body.get(campo):
                return response(400, {"message": f"El campo '{campo}' es obligatorio"})

        nombres     = body["nombres"]
        apellidos   = body["apellidos"]
        dni         = body["dni"]
        correo      = body["correo"]
        password    = body["password"]
        rol         = body["rol"]

        # Validar DNI
        if not dni.isdigit() or len(dni) != 8:
            return response(400, {"message": "El DNI debe tener exactamente 8 dígitos numéricos"})

        # Validar correo
        patron_correo = r"^[\w\.-]+@[\w\.-]+\.\w+$"
        if not re.match(patron_correo, correo):
            return response(400, {"message": "El correo tiene un formato inválido"})

        # Validar rol permitido
        if rol not in ROLES_VALIDOS:
            return response(400, {"message": "Rol inválido. Roles permitidos: Estudiante, Personal administrativo, Autoridad"})

        # Validar correo único
        resp_correo = table.scan(
            FilterExpression="correo = :correo",
            ExpressionAttributeValues={":correo": correo}
        )
        if resp_correo["Count"] > 0:
            return response(409, {"message": "El correo ya está registrado"})

        # Validar DNI único
        resp_dni = table.scan(
            FilterExpression="dni = :dni",
            ExpressionAttributeValues={":dni": dni}
        )
        if resp_dni["Count"] > 0:
            return response(409, {"message": "El DNI ya está registrado"})

        # Crear usuario
        user_id = str(uuid.uuid4())
        hashed_pwd = hash_password(password)

        item = {
            "user_id": user_id,
            "nombres": nombres,
            "apellidos": apellidos,
            "dni": dni,
            "correo": correo,
            "password": hashed_pwd,
            "rol": rol
        }

        table.put_item(Item=item)

        return response(200, {
            "message": "Usuario registrado correctamente",
            "user_id": user_id
        })

    except Exception as e:
        return response(500, {"message": f"Error interno: {str(e)}"})

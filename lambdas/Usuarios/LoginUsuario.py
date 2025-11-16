import boto3
import hashlib
import uuid
import json
import os
import jwt
from datetime import datetime, timedelta
from lambdas.utils import response

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def lambda_handler(event, context):
    try:
        # Parsear body
        body = json.loads(event.get("body", "{}"))

        correo = body.get("correo")
        password = body.get("password")

        if not correo or not password:
            return response(400, {"error": "correo y password son obligatorios"})

        hashed_password = hash_password(password)

        # Conectar DynamoDB
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(os.environ["USERS_TABLE"])

        # Buscar por correo (porque no es PK)
        resp = table.scan(
            FilterExpression="correo = :correo",
            ExpressionAttributeValues={":correo": correo}
        )

        if resp["Count"] == 0:
            return response(403, {"error": "Usuario no existe"})

        usuario = resp["Items"][0]

        # Validar contraseña
        if hashed_password != usuario["password"]:
            return response(403, {"error": "Password incorrecto"})

        # GENERAR JWT
        secret = os.environ["JWT_SECRET"]

        payload = {
            "user_id": usuario["user_id"],
            "correo": usuario["correo"],
            "rol": usuario["rol"],
            "exp": datetime.utcnow() + timedelta(hours=1)
        }

        token = jwt.encode(payload, secret, algorithm="HS256")

        # Respuesta
        return response(200, {
            "message": "Login exitoso",
            "token": token,
            "expira_en": "1 hora"
        })

    except Exception as e:
        return response(500, {"error": str(e)})

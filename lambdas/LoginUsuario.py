import boto3
import hashlib
import uuid
import json
import os
import jwt
from datetime import datetime, timedelta

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def lambda_handler(event, context):
    try:
        
        # Parsear body
        
        body = json.loads(event.get("body", "{}"))

        correo = body.get("correo")
        password = body.get("password")

        if not correo or not password:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "correo y password son obligatorios"})
            }

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
            return {
                "statusCode": 403,
                "body": json.dumps({"error": "Usuario no existe"})
            }

        usuario = resp["Items"][0]

        
        # Validar contraseña
        
        if hashed_password != usuario["password"]:
            return {
                "statusCode": 403,
                "body": json.dumps({"error": "Password incorrecto"})
            }

        
        # GENERAR JWT
        
        secret = os.environ["JWT_SECRET"]

        payload = {
            "user_id": usuario["user_id"],
            "correo": usuario["correo"],
            "rol": usuario["rol"],
            "exp": datetime.utcnow() + timedelta(hours=1)
        }

        token = jwt.encode(payload, secret, algorithm="HS256")

        
        #Respuesta
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Login exitoso",
                "token": token,
                "expira_en": "1 hora"
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

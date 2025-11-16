import boto3
import json
import os

dynamodb = boto3.resource("dynamodb")
table_name = os.environ["SOCKET_TABLE"]
table = dynamodb.Table(table_name)

def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]

    # Datos enviados por el cliente al abrir el WebSocket
    body = json.loads(event.get("body", "{}"))
    rol = body.get("rol", "Estudiante")  # default por si acaso
    user_id = body.get("user_id", "")

    table.put_item(Item={
        "connectionId": connection_id,
        "rol": rol,
        "user_id": user_id
    })

    return {"statusCode": 200}

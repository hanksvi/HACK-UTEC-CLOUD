import os
import json
import boto3
from decimal import Decimal
from lambdas.utils import response

def clean_decimals(obj):
    if isinstance(obj, list):
        return [clean_decimals(i) for i in obj]
    if isinstance(obj, dict):
        return {k: clean_decimals(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    return obj

def lambda_handler(event, context):
    try:
        table_name = os.environ.get("INCIDENTS_TABLE", "Incidents")
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(table_name)

        # SCAN para obtener todos los incidentes
        resp = table.scan()

        items = clean_decimals(resp.get("Items", []))

        return response(200, items)

    except Exception as e:
        return response(500, {
            "message": "error interno",
            "error": str(e)
        })

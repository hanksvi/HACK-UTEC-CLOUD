import boto3
import json
import os

def notify_admins(message):
    dynamodb = boto3.resource("dynamodb")
    table_name = os.environ["SOCKET_TABLE"]
    table = dynamodb.Table(table_name)

    client = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=os.environ["WEBSOCKET_ENDPOINT"]
    )

    response = table.scan(
        FilterExpression="rol = :rol",
        ExpressionAttributeValues={":rol": "Personal Administrativo"}
    )

    for conn in response.get("Items", []):
        try:
            client.post_to_connection(
                ConnectionId=conn["connectionId"],
                Data=json.dumps(message).encode("utf-8")
            )
        except:
            table.delete_item(Key={"connectionId": conn["connectionId"]})

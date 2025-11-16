import boto3

dynamodb = boto3.resource("dynamodb")
table_name = os.environ["SOCKET_TABLE"]
table = dynamodb.Table(table_name)

def handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    table.delete_item(Key={"connectionId": connection_id})
    return {"statusCode": 200}

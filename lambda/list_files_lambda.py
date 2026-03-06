import json
import os
from decimal import Decimal

import boto3

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "FileMetadata")
table = dynamodb.Table(TABLE_NAME)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super().default(obj)


def lambda_handler(_event, _context):
    try:
        response = table.scan()
        items = response.get("Items", [])

        items.sort(key=lambda x: x.get("uploadTime", ""), reverse=True)

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
            },
            "body": json.dumps(items, cls=DecimalEncoder),
        }
    except Exception as error:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {"ok": False, "message": "Error listando archivos", "error": str(error)}
            ),
        }

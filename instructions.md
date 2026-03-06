# Guía de Implementación: Lambda + S3 + DynamoDB

## Paso 1: Crear tabla DynamoDB

Crea la tabla para almacenar metadatos de archivos:

```bash
aws dynamodb create-table \
  --table-name FileMetadata \
  --attribute-definitions AttributeName=fileName,AttributeType=S \
  --key-schema AttributeName=fileName,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Verifica que la tabla fue creada:

```bash
aws dynamodb list-tables
```

---

## Paso 2: Crear la función Lambda

Crea el archivo de la función Lambda:

```bash
nano lambda_function.py
```

Pega el siguiente código en el editor:

```python
import json
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('FileMetadata')

def lambda_handler(event, context):

    for record in event['Records']:

        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        size = record['s3']['object']['size']

        table.put_item(
            Item={
                "fileName": key,
                "bucket": bucket,
                "size": size,
                "uploadTime": str(datetime.now())
            }
        )

        print("Metadata guardada:", key)

    return {
        "statusCode": 200
    }

```

Guarda el archivo (Ctrl+O, Enter, Ctrl+X).

---

## Paso 3: Empaquetar la función Lambda

Crea un archivo ZIP con la función:

```bash
zip function.zip lambda_function.py
```

---

## Paso 4: Obtener el ARN del rol IAM

Lista los roles disponibles y copia el ARN del rol que usarás:

```bash
aws iam list-roles | grep arn
```

---

## Paso 5: Crear la función Lambda en AWS

Reemplaza `arn:aws:iam::418386702932:role/LabRole` con el ARN obtenido en el paso anterior:

```bash
aws lambda create-function \
  --function-name save-file-metadata \
  --runtime python3.11 \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::418386702932:role/LabRole
```

---

## Paso 6: Agregar permisos a la función Lambda

Permite que S3 invoque la función:

```bash
aws lambda add-permission \
  --function-name save-file-metadata \
  --principal s3.amazonaws.com \
  --statement-id s3invoke \
  --action "lambda:InvokeFunction" \
  --source-arn arn:aws:s3:::demo-archivos-daniel-2026
```

---

## Paso 7: Crear el archivo de configuración de notificaciones

Crea el archivo de configuración JSON:

```bash
nano notification.json
```

Pega la siguiente configuración:

```json
{
  "LambdaFunctionConfigurations": [
    {
      "LambdaFunctionArn": "arn:aws:lambda:us-east-1:418386702932:function:save-file-metadata",
      "Events": ["s3:ObjectCreated:*"]
    }
  ]
}

```

Guarda el archivo (Ctrl+O, Enter, Ctrl+X).

---

## Paso 8: Crear el bucket S3

Crea el bucket para almacenar archivos:

```bash
aws s3 mb s3://demo-archivos-daniel-2026
```

---

## Paso 9: Configurar notificaciones del bucket S3

Configura S3 para invocar la función Lambda cuando se suban archivos:

```bash
aws s3api put-bucket-notification-configuration \
  --bucket demo-archivos-daniel-2026 \
  --notification-configuration file://notification.json
```

---

## Paso 10: Probar la integración

Crea un archivo de prueba:

```bash
touch test.txt
```

Sube el archivo al bucket:

```bash
aws s3 cp test.txt s3://demo-archivos-daniel-2026
```

---

## Paso 11: Verificar resultados

Escanea la tabla DynamoDB para confirmar que el metadata fue registrado:

```bash
aws dynamodb scan --table-name FileMetadata
```

---

## Notas

- Reemplaza los valores de ARN y nombres de buckets según tu configuración
- La función Lambda se ejecutará automáticamente cuando se suban archivos a S3
- Verifica los logs de CloudWatch para solucionar problemas 


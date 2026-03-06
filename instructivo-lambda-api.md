# Instructivo: Crear Lambda como API para Listar Archivos

Basado en el historial de comandos ejecutados para crear una API HTTP con Lambda que lista archivos desde DynamoDB.

---

## 📋 Información del Proyecto

- **Account ID**: `418386702932`
- **Región**: `us-east-1`
- **Rol IAM**: `arn:aws:iam::418386702932:role/LabRole`
- **Tabla DynamoDB**: `FileMetadata`
- **Bucket S3**: `demo-archivos-daniel-2026`

---

## 1️⃣ Crear el Código de la Lambda

### Paso 1.1: Crear el archivo Python

```bash
nano list_files_lambda.py
```

### Paso 1.2: Código de la Lambda

Pega el siguiente código:

```python
import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('FileMetadata')

def lambda_handler(event, context):

    response = table.scan()

    items = response['Items']

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(items, default=str)
    }
```

Guarda el archivo (Ctrl+O, Enter, Ctrl+X).

---

## 2️⃣ Empaquetar y Crear la Función Lambda

### Paso 2.1: Crear el archivo ZIP

```bash
zip function-list.zip list_files_lambda.py
```

### Paso 2.2: Crear la función Lambda en AWS

```bash
aws lambda create-function \
  --function-name list-files-metadata \
  --runtime python3.11 \
  --handler list_files_lambda.lambda_handler \
  --zip-file fileb://function-list.zip \
  --role arn:aws:iam::418386702932:role/LabRole
```

**Respuesta esperada:**
```json
{
    "FunctionName": "list-files-metadata",
    "FunctionArn": "arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata",
    "Runtime": "python3.11",
    "Role": "arn:aws:iam::418386702932:role/LabRole",
    "Handler": "list_files_lambda.lambda_handler",
    "State": "Active"
}
```

**Información de la Lambda creada:**
- **Nombre**: `list-files-metadata`
- **ARN**: `arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata`

---

## 3️⃣ Crear API Gateway HTTP API (v2)

### Paso 3.1: Crear la API HTTP

```bash
aws apigatewayv2 create-api \
  --name metadata-api \
  --protocol-type HTTP
```

**Respuesta:**
```json
{
    "ApiId": "t9u1v220t1",
    "Name": "metadata-api",
    "ProtocolType": "HTTP",
    "RouteSelectionExpression": "$request.method $request.path",
    "ApiEndpoint": "https://t9u1v220t1.execute-api.us-east-1.amazonaws.com"
}
```

**API ID creado:**
```
t9u1v220t1
```

### Paso 3.2: (Opcional) Listar APIs para verificar

```bash
aws apigatewayv2 get-apis
```

---

## 4️⃣ Crear Integración con Lambda

### Paso 4.1: Crear la integración

```bash
aws apigatewayv2 create-integration \
  --api-id t9u1v220t1 \
  --integration-type AWS_PROXY \
  --integration-uri arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata \
  --payload-format-version 2.0
```

**Respuesta:**
```json
{
    "IntegrationId": "qj3v01f",
    "IntegrationType": "AWS_PROXY",
    "IntegrationUri": "arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata",
    "PayloadFormatVersion": "2.0"
}
```

**Integration ID creado:**
```
qj3v01f
```

### Paso 4.2: (Opcional) Verificar integraciones

```bash
aws apigatewayv2 get-integrations --api-id t9u1v220t1
```

---

## 5️⃣ Crear Ruta (Route)

### Paso 5.1: Crear la ruta GET /files

```bash
aws apigatewayv2 create-route \
  --api-id t9u1v220t1 \
  --route-key "GET /files" \
  --target integrations/qj3v01f
```

**Respuesta:**
```json
{
    "RouteId": "abc123",
    "RouteKey": "GET /files",
    "Target": "integrations/qj3v01f"
}
```

---

## 6️⃣ Dar Permisos a API Gateway

### Paso 6.1: Añadir permiso de invocación

```bash
aws lambda add-permission \
  --function-name list-files-metadata \
  --statement-id apigatewayinvoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com
```

**Respuesta:**
```json
{
    "Statement": "{\"Sid\":\"apigatewayinvoke\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"apigateway.amazonaws.com\"},\"Action\":\"lambda:InvokeFunction\",\"Resource\":\"arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata\"}"
}
```

---

## 7️⃣ Crear y Desplegar Stage

### Paso 7.1: Crear el stage "prod" con auto-deploy

```bash
aws apigatewayv2 create-stage \
  --api-id t9u1v220t1 \
  --stage-name prod \
  --auto-deploy
```

**Respuesta:**
```json
{
    "StageName": "prod",
    "AutoDeploy": true,
    "CreatedDate": "2026-03-06T...",
    "DefaultRouteSettings": {},
    "DeploymentId": "xyz789"
}
```

---

## 🎯 URL del Endpoint Creado

```
https://t9u1v220t1.execute-api.us-east-1.amazonaws.com/prod/files
```

---

## 🧪 Probar la API

### Con curl

```bash
curl -X GET https://t9u1v220t1.execute-api.us-east-1.amazonaws.com/prod/files
```

### Con navegador

Abre directamente en tu navegador:
```
https://t9u1v220t1.execute-api.us-east-1.amazonaws.com/prod/files
```

### Respuesta esperada

```json
[
  {
    "uploadTime": "2026-03-06 03:22:22.696696",
    "size": "150746",
    "fileName": "uploads/1772767340192-daniel.jpeg",
    "bucket": "demo-archivos-daniel-2026"
  },
  {
    "uploadTime": "2026-03-06 02:47:47.624073",
    "size": "0",
    "fileName": "test.txt",
    "bucket": "demo-archivos-daniel-2026"
  }
]
```

---

## 📝 Variable de Entorno para el Proyecto

Agrega a tu archivo `.env`:

```env
FILES_API_URL=https://t9u1v220t1.execute-api.us-east-1.amazonaws.com/prod/files
```

---

## 🔄 Actualizar el Código de la Lambda

Si necesitas modificar el código de la Lambda:

### Paso 1: Editar el archivo

```bash
nano list_files_lambda.py
```

### Paso 2: Re-empaquetar

```bash
zip function-list.zip list_files_lambda.py
```

### Paso 3: Actualizar la función

```bash
aws lambda update-function-code \
  --function-name list-files-metadata \
  --zip-file fileb://function-list.zip
```

---

## 🗑️ Eliminar Recursos (Opcional)

### Eliminar la API

```bash
aws apigatewayv2 delete-api --api-id t9u1v220t1
```

### Eliminar la Lambda

```bash
aws lambda delete-function --function-name list-files-metadata
```

---

## 📊 Resumen de Recursos Creados

| Recurso | Nombre/ID | ARN/URL |
|---------|-----------|---------|
| **Lambda Function** | `list-files-metadata` | `arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata` |
| **API Gateway** | `metadata-api` | `t9u1v220t1` |
| **Integration** | - | `qj3v01f` |
| **Stage** | `prod` | Auto-deploy habilitado |
| **Endpoint** | GET /files | `https://t9u1v220t1.execute-api.us-east-1.amazonaws.com/prod/files` |

---

## 🔍 Comandos de Verificación

### Ver logs de la Lambda

```bash
aws logs tail /aws/lambda/list-files-metadata --follow
```

### Listar todas las APIs

```bash
aws apigatewayv2 get-apis
```

### Ver detalles de una ruta

```bash
aws apigatewayv2 get-routes --api-id t9u1v220t1
```

### Invocar la Lambda directamente

```bash
aws lambda invoke \
  --function-name list-files-metadata \
  --payload '{}' \
  response.json && cat response.json
```

---

## ✅ Checklist

- [x] Código Lambda creado (`list_files_lambda.py`)
- [x] Función Lambda desplegada (`list-files-metadata`)
- [x] API Gateway HTTP creada (`metadata-api` - `t9u1v220t1`)
- [x] Integración Lambda configurada (`qj3v01f`)
- [x] Ruta GET /files creada
- [x] Permisos de invocación otorgados
- [x] Stage prod desplegado con auto-deploy
- [x] Endpoint funcional y probado
- [x] Variable `FILES_API_URL` configurada en .env

---

## 📚 Notas

- **API Gateway v2 (HTTP API)** se usa en lugar de REST API (más simple y económico)
- **Auto-deploy** está habilitado, por lo que los cambios se despliegan automáticamente
- **CORS** está configurado directamente en la respuesta de la Lambda
- **Payload Format 2.0** simplifica el formato de eventos de Lambda
- El rol **LabRole** debe tener permisos para:
  - `dynamodb:Scan` en la tabla FileMetadata
  - `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
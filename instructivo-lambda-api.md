# Instructivo: Crear Lambda como API con AWS CLI

## 📋 Requisitos Previos

- AWS CLI instalado y configurado (`aws configure`)
- Permisos de IAM adecuados
- Python 3.9+ (para el código Lambda)
- Tabla DynamoDB creada (nombre: `FileMetadata`)

---

## 1️⃣ Crear el Rol IAM para Lambda

```bash
# Crear archivo de política de confianza
cat > lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Crear el rol
aws iam create-role \
  --role-name LambdaListFilesRole \
  --assume-role-policy-document file://lambda-trust-policy.json

# Adjuntar políticas necesarias
aws iam attach-role-policy \
  --role-name LambdaListFilesRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Crear política personalizada para DynamoDB
cat > lambda-dynamodb-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/FileMetadata"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name LambdaListFilesRole \
  --policy-name DynamoDBReadPolicy \
  --policy-document file://lambda-dynamodb-policy.json
```

**ARN del Rol creado:**
```
arn:aws:iam::<ACCOUNT_ID>:role/LambdaListFilesRole
```
*(Reemplaza `<ACCOUNT_ID>` con tu ID de cuenta AWS)*

---

## 2️⃣ Crear el Código de la Lambda

### Código Lambda (Python 3.9)

```python
# lambda/list_files_lambda.py

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


def lambda_handler(event, context):
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
```

### Empaquetar el Código

```bash
# Crear directorio temporal
mkdir -p lambda-package
cd lambda-package

# Copiar el código
cp ../lambda/list_files_lambda.py .

# Si necesitas dependencias adicionales (opcional)
# pip install -t . nombre-paquete

# Crear el archivo ZIP
zip -r ../list_files_lambda.zip .

# Volver al directorio principal
cd ..
rm -rf lambda-package
```

---

## 3️⃣ Crear la Función Lambda

```bash
# Crear la función Lambda
aws lambda create-function \
  --function-name ListFilesFunction \
  --runtime python3.9 \
  --role arn:aws:iam::<ACCOUNT_ID>:role/LambdaListFilesRole \
  --handler list_files_lambda.lambda_handler \
  --zip-file fileb://list_files_lambda.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables={DYNAMODB_TABLE_NAME=FileMetadata} \
  --region us-east-1
```

**Respuesta esperada:**
```json
{
    "FunctionName": "ListFilesFunction",
    "FunctionArn": "arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:ListFilesFunction",
    "Runtime": "python3.9",
    "Role": "arn:aws:iam::<ACCOUNT_ID>:role/LambdaListFilesRole",
    "Handler": "list_files_lambda.lambda_handler",
    "State": "Active"
}
```

**ID de la Función:**
```
ListFilesFunction
```

**ARN de la Función:**
```
arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:ListFilesFunction
```

---

## 4️⃣ Crear API Gateway (REST API)

```bash
# Crear API REST
aws apigateway create-rest-api \
  --name "FilesAPI" \
  --description "API para listar archivos desde DynamoDB" \
  --region us-east-1
```

**Guardar el `api-id` de la respuesta:**
```json
{
    "id": "t9u1v220t1",
    "name": "FilesAPI",
    "createdDate": "2026-03-06T..."
}
```

**API ID:**
```
t9u1v220t1
```

### Obtener el Resource ID raíz

```bash
aws apigateway get-resources \
  --rest-api-id t9u1v220t1 \
  --region us-east-1
```

**Root Resource ID:**
```
<ROOT_RESOURCE_ID>
```

### Crear el recurso `/files`

```bash
aws apigateway create-resource \
  --rest-api-id t9u1v220t1 \
  --parent-id <ROOT_RESOURCE_ID> \
  --path-part files \
  --region us-east-1
```

**Files Resource ID:**
```
<FILES_RESOURCE_ID>
```

---

## 5️⃣ Configurar el Método GET

```bash
# Crear método GET
aws apigateway put-method \
  --rest-api-id t9u1v220t1 \
  --resource-id <FILES_RESOURCE_ID> \
  --http-method GET \
  --authorization-type NONE \
  --region us-east-1

# Integrar con Lambda
aws apigateway put-integration \
  --rest-api-id t9u1v220t1 \
  --resource-id <FILES_RESOURCE_ID> \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:ListFilesFunction/invocations \
  --region us-east-1
```

---

## 6️⃣ Dar Permisos a API Gateway para Invocar Lambda

```bash
aws lambda add-permission \
  --function-name ListFilesFunction \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:<ACCOUNT_ID>:t9u1v220t1/*/*/files" \
  --region us-east-1
```

---

## 7️⃣ Configurar CORS (Opcional)

```bash
# Crear método OPTIONS para CORS
aws apigateway put-method \
  --rest-api-id t9u1v220t1 \
  --resource-id <FILES_RESOURCE_ID> \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region us-east-1

aws apigateway put-integration \
  --rest-api-id t9u1v220t1 \
  --resource-id <FILES_RESOURCE_ID> \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
  --region us-east-1

aws apigateway put-method-response \
  --rest-api-id t9u1v220t1 \
  --resource-id <FILES_RESOURCE_ID> \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers": true, "method.response.header.Access-Control-Allow-Methods": true, "method.response.header.Access-Control-Allow-Origin": true}' \
  --region us-east-1

aws apigateway put-integration-response \
  --rest-api-id t9u1v220t1 \
  --resource-id <FILES_RESOURCE_ID> \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'", "method.response.header.Access-Control-Allow-Methods": "'"'"'GET,OPTIONS'"'"'", "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"}' \
  --region us-east-1
```

---

## 8️⃣ Desplegar la API

```bash
# Crear deployment y stage
aws apigateway create-deployment \
  --rest-api-id t9u1v220t1 \
  --stage-name prod \
  --stage-description "Producción" \
  --description "Primer despliegue de la API" \
  --region us-east-1
```

**URL del Endpoint:**
```
https://t9u1v220t1.execute-api.us-east-1.amazonaws.com/prod/files
```

---

## 9️⃣ Probar la API

### Con curl

```bash
curl -X GET https://t9u1v220t1.execute-api.us-east-1.amazonaws.com/prod/files
```

### Con navegador

Abre en tu navegador:
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

## 🔄 Actualizar el Código de la Lambda

Si necesitas actualizar el código después:

```bash
# 1. Modificar el código
# 2. Empaquetar nuevamente
cd lambda-package
zip -r ../list_files_lambda.zip .
cd ..

# 3. Actualizar la función
aws lambda update-function-code \
  --function-name ListFilesFunction \
  --zip-file fileb://list_files_lambda.zip \
  --region us-east-1
```

---

## 🗑️ Limpiar Recursos (Opcional)

```bash
# Eliminar la API
aws apigateway delete-rest-api \
  --rest-api-id t9u1v220t1 \
  --region us-east-1

# Eliminar la función Lambda
aws lambda delete-function \
  --function-name ListFilesFunction \
  --region us-east-1

# Eliminar el rol IAM
aws iam detach-role-policy \
  --role-name LambdaListFilesRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam delete-role-policy \
  --role-name LambdaListFilesRole \
  --policy-name DynamoDBReadPolicy

aws iam delete-role \
  --role-name LambdaListFilesRole
```

---

## 📝 Notas Importantes

1. **Reemplazar valores**: Sustituye `<ACCOUNT_ID>`, `<ROOT_RESOURCE_ID>`, y `<FILES_RESOURCE_ID>` con tus valores reales.

2. **Región**: Los comandos usan `us-east-1`. Cambia según tu configuración.

3. **Seguridad**: En producción, considera:
   - Autenticación con API Keys o Cognito
   - Limitar CORS a dominios específicos
   - Implementar rate limiting

4. **Monitoreo**: Revisa los logs en CloudWatch:
   ```bash
   aws logs tail /aws/lambda/ListFilesFunction --follow
   ```

5. **Variables de entorno**: La tabla DynamoDB se configura como variable de entorno en la Lambda.

---

## ✅ Checklist de Verificación

- [ ] Rol IAM creado con permisos correctos
- [ ] Código Lambda empaquetado y subido
- [ ] Función Lambda creada y activa
- [ ] API Gateway REST API creada
- [ ] Recurso `/files` creado
- [ ] Método GET configurado
- [ ] Integración Lambda + API Gateway configurada
- [ ] Permisos de invocación otorgados
- [ ] CORS configurado (si es necesario)
- [ ] Deployment creado en stage `prod`
- [ ] URL del endpoint probada y funcional

---

## 🔗 Referencias

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/)

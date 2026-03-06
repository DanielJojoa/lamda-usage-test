nano list_files_lambda.py
   44  zip function-list.zip list_files_lambda.py
   45  aws lambda create-function --function-name list-files-metadata --runtime python3.11 --handler list_files_lambda.lambda_handler --zip-file fileb://function-list.zip --role arn:aws:iam::418386702932:role/LabRole
   46  aws apigatewayv2 create-api --name metadata-api --protocol-type HTTP
   47  aws apigatewayv2 create-integration --api-id API_ID --integration-type AWS_PROXY --integration-uri arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata --payload-format-version 2.0
   48  aws apigatewayv2 get-apis
   49  aws apigatewayv2 create-integration --api-id t9u1v220t1 --integration-type AWS_PROXY --integration-uri arn:aws:lambda:us-east-1:418386702932:function:list-files-metadata --payload-format-version 2.0
   50  aws apigatewayv2 create-route --api-id t9u1v220t1 --route-key "GET /files" --target integrations/abc123
   51  aws configure
   52  aws apigatewayv2 create-route --api-id t9u1v220t1 --route-key "GET /files" --target integrations/abc123
   53  aws apigatewayv2 get-integrations --api-id t9u1v220t1
   54  aws apigatewayv2 create-route --api-id t9u1v220t1 --route-key "GET /files" --target integrations/qj3v01f
   55  aws lambda add-permission --function-name list-files-metadata --statement-id apigatewayinvoke --action lambda:InvokeFunction --principal apigateway.amazonaws.com
   56  aws apigatewayv2 create-stage --api-id t9u1v220t1 --stage-name prod --auto-deploy
   57  history

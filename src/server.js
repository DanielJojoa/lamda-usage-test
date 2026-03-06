const path = require('path');
const https = require('https');
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN,
  S3_BUCKET_NAME,
  S3_FOLDER,
  FILES_API_URL,
  PORT = 3000,
} = process.env;

if (!AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_BUCKET_NAME || !FILES_API_URL) {
  console.error(
    'Faltan variables de entorno requeridas. Revisa .env y define AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME y FILES_API_URL.'
  );
  process.exit(1);
}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
  },
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'No se recibió ningún archivo.',
      });
    }

    const safeName = req.file.originalname.replace(/\s+/g, '-');
    const objectKey = `${S3_FOLDER || 'uploads'}/${Date.now()}-${safeName}`;

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: objectKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    });

    await s3Client.send(command);

    return res.status(200).json({
      ok: true,
      message: 'Archivo subido correctamente a S3.',
      bucket: S3_BUCKET_NAME,
      key: objectKey,
    });
  } catch (error) {
    console.error('Error al subir archivo a S3:', error);
    return res.status(500).json({
      ok: false,
      message: 'No se pudo subir el archivo.',
      error: error.message,
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 's3-upload-demo' });
});

app.get('/files', async (_req, res) => {
  try {
    console.log(`Consultando ${FILES_API_URL}...`);

    const data = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout: La petición tardó más de 30 segundos'));
      }, 30000);

      https.get(FILES_API_URL, {
        headers: {
          'Accept': 'application/json',
        },
      }, (response) => {
        clearTimeout(timeoutId);
        console.log(`Respuesta recibida: ${response.statusCode}`);

        let rawData = '';

        response.on('data', (chunk) => {
          rawData += chunk;
        });

        response.on('end', () => {
          try {
            let parsedData = JSON.parse(rawData);

            // API Gateway + Lambda proxy can return payload as:
            // { statusCode, headers, body: "[...]" }
            if (parsedData && typeof parsedData === 'object' && typeof parsedData.body === 'string') {
              try {
                parsedData = JSON.parse(parsedData.body);
              } catch {
                parsedData = [];
              }
            }

            // Some integrations return { items: [...] } or { Items: [...] }
            if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)) {
              if (Array.isArray(parsedData.items)) {
                parsedData = parsedData.items;
              } else if (Array.isArray(parsedData.Items)) {
                parsedData = parsedData.Items;
              }
            }

            if (response.statusCode !== 200) {
              reject({
                statusCode: response.statusCode,
                data: parsedData,
              });
            } else {
              resolve(Array.isArray(parsedData) ? parsedData : []);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });

    return res.json(data);
  } catch (error) {
    console.error('Error consultando endpoint de archivos:', error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        ok: false,
        message: 'No se pudo obtener el listado de archivos.',
        details: error.data,
      });
    }

    return res.status(500).json({
      ok: false,
      message: 'Error interno consultando listado de archivos.',
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});

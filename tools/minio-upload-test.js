const { S3Client, CreateBucketCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

async function main() {
  const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  const bucket = process.env.MINIO_BUCKET || 'oddnote-uploads';
  const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

  const client = new S3Client({ endpoint, region: 'us-east-1', credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }, forcePathStyle: true });

  // ensure bucket
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket '${bucket}' exists`);
  } catch (e) {
    console.log(`Bucket '${bucket}' not found, creating`);
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket '${bucket}' created`);
  }

  // prepare tiny png
  const pngPath = 'tools/test-1x1.png';
  if (!fs.existsSync(pngPath)) {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
    fs.writeFileSync(pngPath, Buffer.from(b64, 'base64'));
    console.log('Wrote', pngPath);
  }

  const key = `test-${Date.now()}-1x1.png`;
  const body = fs.readFileSync(pngPath);

  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'image/png' }));
  const publicUrl = `${endpoint}/${bucket}/${encodeURIComponent(key)}`;
  console.log('Uploaded ->', publicUrl);

  // generate presigned URL and fetch
  try {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const signedUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
    console.log('Presigned URL ->', signedUrl);
    const res = await fetch(signedUrl);
    console.log('GET presigned status', res.status);
    if (res.ok) {
      const m = await res.arrayBuffer();
      console.log('Downloaded bytes:', m.byteLength);
    } else {
      console.log('GET failed, response text:', await res.text());
    }
  } catch (err) {
    console.error('Presigned fetch error:', err);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

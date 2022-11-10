# NodeBB Upload plugin

`npm install @dasmeta/nodebb-plugin-upload`

A plugin for NodeBB to take file uploads and store them on S3, Google Cloud Storage or Minio


## S3 Uploads Configuration


You can configure this plugin via **environment variables**. You can also configure via the NodeBB Admin panel, which will result in the Bucket and Credentials being stored in the NodeBB Database.

If you decide to use the Database storage for Credentials, then they will take precedence over Environment Variables.

### Environment Variables

```
export UPLOAD_PROVIDER="s3|gcs|minio"

// s3
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export S3_UPLOADS_BUCKET="your-bucket-name"
export S3_UPLOADS_HOST="host"
export S3_UPLOADS_PATH="path"
export ACL="ACL"
export CLOUD_FRONT_DOMAIN="cloud-front-url"

// gcs
export GCS_SERVICE_ACCOUNT="your-service-account-json"
export GCS_UPLOAD_BUCKET="your-bucket-name"
export GCS_UPLOAD_HOST="host"
export GCS_UPLOAD_PATH="path"

// minio
export MINIO_ACCESS_KEY="your-access-key"
export MINIO_SECRET_KEY="your-secret-key"
export MINIO_UPLOAD_BUCKET="your-bucket-name"
export MINIO_UPLOAD_HOST="host"
export MINIO_UPLOAD_PATH="path"
```

**NOTE:** Asset host is optional - If you do not specify an asset host, then the default asset host is `<bucket>.s3.amazonaws.com`.
**NOTE:** Asset path is optional - If you do not specify an asset path, then the default asset path is `/`.

### Database Backed Variables

From the NodeBB Admin panel, you can configure the following settings to be stored in the Database:

* `provider` - "s3", "gcs" or "minio"
* `bucket` — The S3 or Minio bucket to upload into
* `host` - The base URL for the asset.
* `path` - The asset path (optional)
* `accessKeyId` — The AWS or Minio Access Key Id
* `secretAccessKey` — The AWS or Minio Secret Access Key
* `serviceAccount` - Google cloud service account JSON (base64 encoded)

**NOTE: Storing your Credentials in the database is bad practice, and you really shouldn't do it.**

We highly recommend using either **Environment Variables** instead.

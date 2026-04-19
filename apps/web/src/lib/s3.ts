import {
  S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand,
  ListObjectsV2Command, DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const region = process.env.S3_REGION ?? "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY ?? "goyapp";
const secretAccessKey = process.env.S3_SECRET_KEY ?? "goyapp-secret";
export const BUCKET = process.env.S3_BUCKET ?? "goyapp";

// Public URL as seen by the browser (outside Docker network).
export const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT ?? "http://localhost:9000";

export const s3 = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
});

let bucketEnsured: Promise<void> | null = null;

export function ensureBucket() {
  if (!bucketEnsured) {
    bucketEnsured = (async () => {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      } catch {
        await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
      }
      // Make objects publicly readable (simplest story for image URLs embedded in SVG).
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicRead",
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      };
      try {
        await s3.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) }));
      } catch (e) {
        console.warn("Could not set bucket policy (non-fatal):", (e as Error).message);
      }
    })();
  }
  return bucketEnsured;
}

export async function putObject(key: string, body: Buffer | Uint8Array, contentType: string) {
  await ensureBucket();
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  return `${PUBLIC_ENDPOINT}/${BUCKET}/${key}`;
}

/** Remove every object under a given prefix. Silent on missing bucket. */
export async function deletePrefix(prefix: string): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;
  try {
    do {
      const list = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET, Prefix: prefix, ContinuationToken: continuationToken,
      }));
      const objs = list.Contents ?? [];
      if (objs.length > 0) {
        await s3.send(new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: objs.map((o) => ({ Key: o.Key! })), Quiet: true },
        }));
        deleted += objs.length;
      }
      continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);
  } catch (e) {
    console.warn("deletePrefix failed (non-fatal):", (e as Error).message);
  }
  return deleted;
}

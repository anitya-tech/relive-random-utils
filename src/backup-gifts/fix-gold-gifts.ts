import { ReceivedGiftStreamList } from "@gtr/random-bilibili-api/dist/apis/live/received-gift-stream-list";

import { getS3, S3Bucket, S3KeyPrefix } from "./config";

async function fixMetadata() {
  const s3 = await getS3();

  let ContinuationToken: string | undefined;

  do {
    const { Contents, NextContinuationToken } = await s3
      .listObjectsV2({
        ContinuationToken,
        Bucket: S3Bucket,
        Prefix: S3KeyPrefix,
        MaxKeys: 100,
      })
      .promise();

    if (!Contents) break;

    for (const obj of Contents) {
      const Key = obj.Key as string;
      console.log(Key);
      const match = Key.match(
        /^(live-gifts\/\d+\/\d{4}\/\d{2}-\d{2})\.all\.json$/
      );

      if (!match) {
        console.log("continue");
        continue;
      }

      const prefix = match[1];

      const resp = await s3.getObject({ Bucket: S3Bucket, Key }).promise();

      const Body = JSON.stringify(
        (resp.Body as ReceivedGiftStreamList.Record[]).filter((i) => i.hamster)
      );

      await s3
        .putObject({
          Body,
          Bucket: S3Bucket,
          Key: `${prefix}.gold.json`,
          ContentType: resp.ContentType,
          CacheControl: resp.CacheControl,
          Metadata: resp.Metadata,
        })
        .promise();
    }

    ContinuationToken = NextContinuationToken;
  } while (ContinuationToken);
}

fixMetadata();

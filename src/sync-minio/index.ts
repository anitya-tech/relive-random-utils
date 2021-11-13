import { vault } from "@gtr/config";
import { S3 } from "aws-sdk";

import { getLogger } from "../common/log";
import { cms } from "../relive-cms/relive-cms";

// Anita
// const storage_policy = "60f985ef72a62f7dd74fd0ef";
// const vault_path = "projects/anitya/relive/base/minio/ro";
// const bucket = "relive-bili";

// Tomoyo Temp Store
const storage_policy = "60fa972f72a62f7dd7507d14";
const vault_path = "projects/random/tomoyo.minio";
const bucket = "oss";

const task_id = new Date().getTime().toString(36);

const start = async () => {
  const logger = await getLogger("sync-minio", `${storage_policy}:${task_id}`);

  const minioCred = await vault.get(vault_path);
  const minio = new S3({
    accessKeyId: minioCred.minio_access_key,
    secretAccessKey: minioCred.minio_secret_key,
    endpoint: minioCred.minio_server,
    s3ForcePathStyle: true,
  });

  let Marker = "";

  while (true) {
    const { NextMarker, Contents } = await minio
      .listObjects({ Bucket: bucket, MaxKeys: 1000, Marker })
      .promise();

    if (!Contents) break;

    for (const item of Contents) {
      if (!item.Key) break;

      const info = await minio
        .headObject({ Bucket: bucket, Key: item.Key })
        .promise();

      // const result = item.Key.match(
      //   /stream\/(?<encode_state>raw|encoded)\/(?<room_id>\d+)\/(?<date>\d{8})\/(?<time>\d{6})\.(?<extension>\w+)/
      // );
      // const { encode_state, room_id, date, time, extension } = result.groups;
      // if (!result?.groups) {
      //   await logger.error(item.Key);
      //   continue;
      // }

      console.log(item.Key);

      try {
        await cms.addFile({
          storage_policy,
          path: item.Key,
          size: info.ContentLength as number,
          hash: "",
          state: 0,
          meta: {
            ...info.Metadata,
            client: "relive-random-utils/sync-minio",
            task_id: task_id,
          },
        });
      } catch (e: any) {
        await logger.error(item.Key);
        await logger.error(e.message);
      }

      await logger.info(item.Key);
    }

    if (!NextMarker) break;
    Marker = NextMarker;
  }
};

start();

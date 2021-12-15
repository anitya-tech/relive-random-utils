import { vault } from "@gtr/config";
import OSS from "ali-oss";

import { getLogger } from "../common/log";
import { cms } from "../relive-cms/relive-cms";

const storage_policy = "60fad5673d6abc5af13bdbc7";
const vault_path = "geektr.co/aliyun/geektr/ram/workspace.geektr.co";
const bucket = "stream-publish";

const task_id = new Date().getTime().toString(36);

const start = async () => {
  const logger = await getLogger("sync-oss", `${storage_policy}:${task_id}`);

  const ossCred = await vault.get(vault_path);
  console.log(ossCred.Ali_Key);
  const client = new OSS({
    accessKeyId: ossCred.Ali_Key,
    accessKeySecret: ossCred.Ali_Secret,
    region: "oss-cn-shanghai",
    bucket,
  });

  let marker = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { nextMarker, objects } = await client.list(
      { "max-keys": 1000, marker },
      {}
    );

    if (!objects) break;

    for (const item of objects) {
      if (!item.name) continue;
      if (!/bilibili\/(\d+)\/record\/(\d{8})\/(\d{6})\.(\w+)/.test(item.name)) {
        logger.error(`key not match: ${item.name}`);
        continue;
      }

      const info = await client.head(item.name);

      console.log(item.name);

      try {
        await cms.addFile({
          storage_policy,
          path: item.name,
          size: Number((info.res.headers as any)["content-length"]),
          hash: "",
          state: 0,
          meta: {
            ...info.meta,
            client: "relive-random-utils/sync-minio",
            task_id: task_id,
          },
        });
      } catch (e: any) {
        await logger.error(item.name);
        await logger.error(e.message);
      }

      await logger.info(item.name);
    }

    if (!nextMarker) break;
    marker = nextMarker;
  }
};

start().catch(console.log);

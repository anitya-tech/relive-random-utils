import os from "os";

import { initMinio, S3 } from "@gtr-infra/minio";
import { initRedis } from "@gtr-infra/redis";
import { onceAsync } from "@gtr/utils";
import moment from "moment-timezone";

export const uploaderIdMap = {
  tsukasa: 8760033,
  horo: 1351379,
  geektr: 3162440,
};

export const uploaderId = uploaderIdMap.geektr;
export const datasource = "api";
export const taskId = `${os.hostname()}/${moment().format(
  "YYYY/MM/DD/HH/mm/ss"
)}`;
export const dynamoPutSize = 25;
export const fetchPageSize = 1000;

const vaultPrefix = `projects/anitya/relive/base`;

export const getS3 = onceAsync(() => initMinio(`${vaultPrefix}/minio/rw`));

export const S3Bucket = "relive-bili";
export const S3KeyPrefix = "live-gifts";

export const getRedis = onceAsync(() =>
  initRedis(`${vaultPrefix}/redis/rw`, "live-gifts-fetcher")
);

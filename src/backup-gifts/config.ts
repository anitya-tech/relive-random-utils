import os from "os";

import { initRedis } from "@gtr-infra/redis";
import { onceAsync } from "@gtr/utils";
import { initMinio } from "infra-minio-v0";
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

export const getAnita = onceAsync(() =>
  initMinio(`projects/relive/core/minio/anita/rw`)
);
export const getMaggie = onceAsync(() =>
  initMinio(`projects/relive/core/minio/maggie/rw`)
);

export const S3Bucket = "relive-bili";
export const S3KeyPrefix = "live-gifts";

export const getRedis = onceAsync(() =>
  initRedis(`${vaultPrefix}/redis/rw`, "live-gifts-fetcher")
);

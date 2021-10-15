import os from "os";

import { getVaultItem } from "@gtr/config";
import { S3 } from "aws-sdk";
import Redis from "ioredis";
import moment from "moment-timezone";

import { onceAsync } from "./utils/once-async";

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

export const getS3 = onceAsync(async () => {
  const minioSecret = await getVaultItem<{
    minio_access_key: string;
    minio_region: string;
    minio_secret_key: string;
    minio_server: string;
  }>(`${vaultPrefix}/minio/rw`);

  return new S3({
    endpoint: minioSecret.minio_server,
    accessKeyId: minioSecret.minio_access_key,
    secretAccessKey: minioSecret.minio_secret_key,
  });
});

export const S3Bucket = "relive-bili";
export const S3KeyPrefix = "live-gifts";

export const getRedis = onceAsync(async () => {
  const redisSecret = await getVaultItem<{
    hostname: string;
    password: string;
    port: number;
    prefix: string;
  }>(`${vaultPrefix}/redis/rw`);

  return new Redis(redisSecret.port, redisSecret.hostname, {
    password: redisSecret.password,
    keyPrefix: `${redisSecret.prefix}:live-gifts-fetcher:`,
  });
});

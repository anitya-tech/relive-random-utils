import { getVaultItem } from "@gtr/config";
import * as dynamoose from "dynamoose";

import { onceAsync } from "./once-async";

interface AwsCreds {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_DEFAULT_REGION: string;
}

export const initDynamoose = onceAsync(async () => {
  const secert = await getVaultItem<AwsCreds>("geektr.co/aws/cn/temp-dynamodb");

  dynamoose.aws.sdk.config.update({
    accessKeyId: secert.AWS_ACCESS_KEY_ID,
    secretAccessKey: secert.AWS_SECRET_ACCESS_KEY,
    region: secert.AWS_DEFAULT_REGION,
  });
});

export const getRecordModel = onceAsync(async () => {
  await initDynamoose();

  const Record = new dynamoose.Schema(
    {
      uploader_id: Number,
      sort_key: String,
      datasource: String,
      task_id: String,
      // origin
      uid: Number,
      uname: String,
      time: Date, // string => date
      gift_id: Number,
      // gift_name: String,
      // gift_img: String,
      // gift_num: Number,
      hamster: Number,
      gold: Number,
      silver: Number,
      ios_hamster: Number,
      normal_hamster: Number,
      ios_gold: Number,
      normal_gold: Number,
      is_hybrid: Boolean,
    },
    {
      saveUnknown: false,
      timestamps: true,
    }
  );

  return dynamoose.model("com.bilibili.live.gift.records.v1", Record);
});

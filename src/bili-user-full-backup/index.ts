/* eslint-disable @typescript-eslint/ban-ts-comment */
import { initMongoose } from "@gtr-infra/mongo";
import { Dynamic } from "@gtr/random-bilibili-api";
import { Schema } from "mongoose";
import mongoose from "mongoose";

import { biliApi } from "./common";

type StoredDynamic = Dynamic.Detail.DynamicDetailCard & {
  desc: Omit<Dynamic.Detail.Desc, "user_profile">;
  is_delete: true;
};

const dynamicSchema = new Schema<StoredDynamic>({
  desc: {
    uid: { type: Number, index: true },
    dynamic_id: { type: Number, index: true },
    dynamic_id_str: { type: String, index: true },
    rid: { type: Number, index: true },
    rid_str: { type: String, index: true },
    timestamp: { type: Number, index: true },
  },
});

const dynamic = mongoose.model("bili_dynamic", dynamicSchema);

const fetchDynamic = async (dynamic_id: string) => {
  const result = await biliApi.dynamic.detail({ dynamic_id });
  if (!("card" in result)) return undefined;
  const newDynamic = result.card;
  // @ts-ignore
  delete newDynamic.desc.user_profile;

};

const saveDynamic = async (dynamic_id: string) => {
  const result = await biliApi.dynamic.detail({ dynamic_id });
  if (!("card" in result)) throw Error(`dynamic: ${dynamic_id} not found`);

  const newDynamic = result.card;
  // @ts-ignore
  delete newDynamic.desc.user_profile;
  const oldDynamic = await dynamic.find({ "desc.dynamic_id_str": dynamic_id });

  if (!oldDynamic) {
    const o = new dynamic();
  }
};

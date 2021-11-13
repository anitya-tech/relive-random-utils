import { Api, ApiOptions } from "@geektr/strapi-client";
import { vault } from "@gtr/config";

export const CmsApi = new Api(() =>
  vault.get<ApiOptions>("projects/anitya/relive/cms/dev/admin-login")
);

export const dev = new Api(() =>
  vault.get<ApiOptions>("projects/anitya/relive/cms/dev/admin-login")
);

// save my aliyun cdn data
// /ip dns static add address=[:resolve konga.geektr.co] name=local.cms.relive.1453.tv
export const prod = new Api(async () => {
  const opts = await vault.get<ApiOptions>(
    "projects/anitya/relive/cms/prod/admin-login"
  );
  return { ...opts, baseURL: "http://local.cms.relive.1453.tv" };
});

export interface File {
  storage_policy: string;
  path: string;
  size: number;
  hash: string;
  state: number;
  meta?: Record<string, any>;
}

const queryFiles = async (state?: number) => {
  const { data } = await CmsApi.instance.get("/storage-files", {
    params: { state },
  });
  return data;
};

const addFile = async (file: File) => {
  const { data } = await CmsApi.instance.post("/storage-files", file);
  return data;
};

const updateFile = async (id: string, state: number) => {
  const { data } = await CmsApi.instance.post(`/storage-files/${id}`, {
    state,
  });
  return data;
};

export const cms = { queryFiles, addFile, updateFile };

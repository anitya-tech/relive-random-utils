import { getVaultItem } from "@gtr/config";
import { Api, ApiOptions } from "@geektr/strapi-client";

const Cms = new Api(() =>
  getVaultItem<ApiOptions>("projects/anitya/relive/cms/dev/admin-login")
);

export interface File {
  storage_policy: string;
  path: string;
  size: number;
  hash: string;
  state: number;
}

const queryFiles = async (state: number) => {
  const { data } = await Cms.instance.get("/storage-files", {
    params: { state },
  });
  return data;
};

const addFile = async (file: File) => {
  const { data } = await Cms.instance.post("/storage-files", file);
  return data;
};

const updateFile = async (id: string, state: number) => {
  const { data } = await Cms.instance.post(`/storage-files/${id}`, { state });
  return data;
};

export const cms = { queryFiles, addFile, updateFile };

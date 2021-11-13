import { dev, prod } from "../relive-cms/relive-cms";

const BatchSize = 1000;

const queryItems = async (route: string, start: number): Promise<any[]> => {
  const { data } = await dev.instance.get(route, {
    params: {
      _limit: BatchSize,
      _start: start,
    },
  });

  return data;
};

async function* loopItems(route: string) {
  let start = 0;
  while (true) {
    try {
      const list = await queryItems(route, start);
      if (!list.length) break;
      for (const item of list) {
        yield item;
      }
    } catch (e) {
      console.log(e);
    }

    start += BatchSize;
  }
}

const clearId = (item: any) => {
  delete item._id;
  delete item.createdAt;
  delete item.updatedAt;
  delete item.__v;
  delete item.id;
};

const start = async () => {
  // for await (const item of loopItems("/relive-users")) {
  //   clearId(item._id);
  //   await prod.instance.post("/relive-users", item);
  // }

  for await (const item of loopItems("/storage-files")) {
    clearId(item._id);

    item.storage_policy = (
      {
        "60fad5673d6abc5af13bdbc7": "60fbf05053f921003598a2de",
        "60f985ef72a62f7dd74fd0ef": "60fbf0ad53f921003598a2df",
        "60fa972f72a62f7dd7507d14": "60fbf0bc53f921003598a2e0",
        "60f6650fa96d0a4665400ef4": "60fbf0cb53f921003598a2e1",
      } as any
    )[item.storage_policy];

    await prod.instance.post("/storage-files", item);
  }
};

start();

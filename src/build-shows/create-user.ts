import axios from "axios";

import { CmsApi } from "./cms-api";

interface RoomInfo {
  roomid: string;
  uid: string;
  uname: string;
}

export const batchCreateUsers = async (roomIds: number[]) => {
  const { data } = await axios.get<{ data: Record<number, RoomInfo> }>(
    `https://api.live.bilibili.com/room/v1/Room/get_info_by_id?${roomIds
      .map((i) => `ids[]=${i}`)
      .join("&")}`
  );

  for (const roomid of roomIds) {
    const roomInfo = data.data[roomid];

    const { data: relive_user } = await CmsApi.instance.get(
      `/relive-users?room_id=${roomid}`
    );
    console.log(relive_user);
    if (relive_user.length) continue;

    try {
      await CmsApi.instance.post("/relive-users", {
        bilibili_uid: Number(roomInfo.uid),
        nickname: roomInfo.uname,
        room_id: Number(roomInfo.roomid),
      });
    } catch (e) {
      console.log(roomid);
      console.log(e);
    }
  }
};

import { userSocketIDs } from "../app";

export const getOtherMember = (members: any[] = [], userId: any) => {
  return members.find((member) => member._id.toString() !== userId);
};

export const getSockets = (users: any[] = []) => {
  if (!users.length) return [];
  
  const sockets = users.flatMap((user) => userSocketIDs.get(user.toString()) || []);

  return sockets;
};


export const getBase64 = (file: any) =>
  `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

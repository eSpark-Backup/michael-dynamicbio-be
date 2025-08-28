import { compare } from "bcrypt";
import { NEW_REQUEST, REFETCH_CHATS } from "../../constants";
import { getOtherMember } from "../../lib";
import { TryCatch } from "../../middleware";
import { Chat, Request, UserForChat } from "../../models";
import { emitEvent, uploadFilesToCloudinary, ErrorHandler } from "../../utils";

const newUser = TryCatch(async (req: any, res: any, next: any) => {
  const { name, username, password, bio } = req.body;

  console.log(req.body);

  //   const file = req.file;

  //   if (!file) return next(new ErrorHandler("Please upload Avatar", 400));

  //   const result = await uploadFilesToCloudinary([file]);

  //   const avatar = {
  //     public_id: result[0].public_id,
  //     url: result[0].url,
  //   };

  const user = await UserForChat.create({
    name,
    bio,
    username,
    password,
    // avatar,
  });
});

// Login user and save token in cookie
const login = TryCatch(async (req: any, res: any, next: any) => {
  const { username, password } = req.body;

  const user = await UserForChat.findOne({ username }).select("+password");

  if (!user) return next(new ErrorHandler("Invalid Username or Password", 404));

  const isMatch = await compare(password, user.password);

  if (!isMatch)
    return next(new ErrorHandler("Invalid Username or Password", 404));
});

const getMyProfile = TryCatch(async (req: any, res: any, next: any) => {
  const user = await UserForChat.findById(req.socketUserId);

  if (!user) return next(new ErrorHandler("User not found", 404));

  res.status(200).json({
    success: true,
    user,
  });
});

const searchUser = TryCatch(async (req: any, res: any) => {
  const { name = "" } = req.query;

  // Get all my chats
  const myChats = await Chat.find({
    groupChat: false,
    members: req.userId,
  });

  // Get all my friends; people I have chatted with from my chats
  const MeAndMyFriends = myChats.flatMap((chat) => chat.members);

  // Ensure your own ID is excluded
  const otherUsers = await UserForChat.find({
    _id: { $nin: [...MeAndMyFriends, req.userId] }, // Explicitly exclude your user ID
    name: { $regex: name, $options: "i" },
  });

  // Get only the necessary fields
  const users = otherUsers.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar.url,
  }));

  return res.status(200).json({
    success: true,
    users,
  });
});

const sendFriendRequest = TryCatch(async (req: any, res: any, next: any) => {
  const { userId } = req.body;

  const request = await Request.findOne({
    $or: [
      { sender: req.userId, receiver: userId },
      { sender: userId, receiver: req.userId },
    ],
  });

  if (request) return next(new ErrorHandler("Request already sent", 400));

  await Request.create({
    sender: req.userId,
    receiver: userId,
  });

  emitEvent(req, NEW_REQUEST, [userId]);

  return res.status(200).json({
    success: true,
    message: "Request sent successfully",
  });
});

const acceptFriendRequest = TryCatch(async (req: any, res: any, next: any) => {
  const { requestId, accept } = req.body;

  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");

  if (!request) return next(new ErrorHandler("Request not found", 404));

  if (request.receiver._id.toString() !== req.userId.toString())
    return next(
      new ErrorHandler("You are not authorized to accept this request", 401)
    );

  if (!accept) {
    await request.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Request declined successfully",
    });
  }

  const members = [request.sender._id, request.receiver._id];

  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name} - ${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "Request accepted successfully",
    senderId: request.sender._id,
  });
});

const getMyNotifications = TryCatch(async (req: any, res: any) => {
  const requests = await Request.find({ receiver: req.userId }).populate(
    "sender",
    "name avatar"
  );

  const allRequests = requests.map(({ _id, sender }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar.url,
    },
  }));

  return res.status(200).json({
    success: true,
    allRequests,
  });
});

const getMyFriends = TryCatch(async (req: any, res: any) => {
  const chatId = req.query.chatId;

  const chats = await Chat.find({
    groupChat: false,
    members: req.userId,
  }).populate("members", "name avatar");

  const friends = chats.map(({ members }) => {
    const otherUser = getOtherMember(members, req.userId);

    return {
      _id: otherUser._id,
      name: otherUser.name,
      avatar: otherUser.avatar.url,
    };
  });

  if (chatId) {
    const chat = await Chat.findById(chatId);

    const availableFriends = friends.filter(
      (friend) => !chat.members.includes(friend._id)
    );

    return res.status(200).json({
      success: true,
      friends: availableFriends,
    });
  } else {
    return res.status(200).json({
      success: true,
      friends,
    });
  }
});

export {
  acceptFriendRequest,
  getMyFriends,
  getMyNotifications,
  getMyProfile,
  login,
  newUser,
  searchUser,
  sendFriendRequest,
};


//localhost:3001/api/chat/user/me
import {
  GROUP_CHAT_ALERT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  REFETCH_CHATS,
} from "../../constants";
import { getOtherMember } from "../../lib/";
import { TryCatch } from "../../middleware";
import { UserForChat, Message, Chat } from "../../models";
import {
  deleteFilesFromCloudinary,
  emitEvent,
  uploadFilesToCloudinary,
  ErrorHandler,
} from "../../utils";
import { AppDataSource } from "../../typeorm.config";
interface IMessage {
  _id: string;
  content: string;
  sender: {
    _id: string;
    name: string;
    avatar?: string;
  };
  chat: string;
  createdAt: Date;
}

const getMyChats = TryCatch(async (req: any, res: any, next: any) => {
  const chats = await Chat.find({ members: req.socketUserId }).populate(
    "members",
    "name avatar accountId"
  );

  const transformedChats = await Promise.all(
    chats.map(
      async ({
        _id,
        name,
        members,
        groupChat,
        accountId,
        createdAt,
        creator,
      }) => {
        const otherMember = getOtherMember(members, req.socketUserId);

        const latestMessage = await Message.findOne({ chat: _id })
          .sort({ createdAt: -1 })
          .populate("sender", "name avatar accountId")
          .lean<IMessage>();

        return {
          _id,
          groupChat,
          avatar: groupChat
            ? members.map((m: any) => m.avatar || "")
            : [otherMember?.avatar || ""],
          name: groupChat ? name : otherMember?.name || "Unknown",
          memberName: groupChat
            ? members.map((m: any) => m.name || "")
            : otherMember?.name || "",
          admin: groupChat ? creator.toString() : false,
          accountId: groupChat
            ? members.map((m: any) => m.accountId || "")
            : otherMember?.accountId || "",
          members: members.reduce((prev: any, curr: any) => {
            if (curr._id.toString() !== req.socketUserId.toString()) {
              prev.push(curr._id);
            }
            return prev;
          }, []),
          lastMessage: latestMessage
            ? {
                content: latestMessage.content,
                sender:
                  latestMessage.sender?._id.toString() ===
                  req.socketUserId.toString()
                    ? "You"
                    : latestMessage.sender?.name || "Unknown",
                createdAt: latestMessage.createdAt,
              }
            : null,
          latestMessageDate: latestMessage?.createdAt || null,

          createdAt: createdAt,
        };
      }
    )
  );
  transformedChats.sort((a, b) => {
    const dateA = new Date(a.latestMessageDate || a.createdAt).getTime();
    const dateB = new Date(b.latestMessageDate || b.createdAt).getTime();
    return dateB - dateA;
  });

  const finalChats = transformedChats.map(
    ({ latestMessageDate, ...rest }) => rest
  );

  res.status(200).json({
    success: true,
    chats: finalChats,
  });
});

const sendAttachments = TryCatch(async (req: any, res: any, next: any) => {
  const { chatId } = req.body;

  const files = req.files || [];

  if (files.length < 1)
    return next(new ErrorHandler("Please Upload Attachments", 400));

  if (files.length > 5)
    return next(new ErrorHandler("You can upload at most 5 files", 400));

  const [chat, user] = await Promise.all([
    Chat.findById(chatId),
    UserForChat.findById(req.socketUserId, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("chat not found", 404));

  if (files.length < 1) return next(new ErrorHandler("No files found", 400));

  // Upload files to cloudinary
  const attachments = await uploadFilesToCloudinary(files);

  const messageForDb = {
    content: "",
    attachments,
    sender: user._id,
    chat: chatId,
  };

  const messageForRealTime = {
    ...messageForDb,
    sender: {
      _id: user._id,
      name: user.name,
    },
  };

  const message = await Message.create(messageForDb);

  emitEvent(req, NEW_MESSAGE, chat.members, {
    message: messageForRealTime,
    chatId,
  });

  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

  res.status(200).json({
    success: true,
    message,
  });
});

const getChatDetails = TryCatch(async (req: any, res: any, next: any) => {
  const chatId = req.params.id;

  if (req.query.populate === "true") {
    const chat: any = await Chat.findById(chatId)
      .populate("members", "name avatar")
      .lean();

    if (!chat) return next(new ErrorHandler("chat not found", 404));

    chat.members = chat.members.map(
      ({
        _id,
        name,
        avatar,
      }: {
        _id: any;
        name: string;
        avatar: { url: string };
      }) => ({
        _id,
        name,
        avatar: avatar.url,
      })
    );

    return res.status(200).json({
      success: true,
      chat,
    });
  } else {
    let chatDetails = await Chat.findById(chatId);

    return res.status(200).json({
      success: true,
      chatDetails,
    });
  }
});

const deleteChat = TryCatch(async (req: any, res: any, next: any) => {
  const chatId = req.params.id;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  const members = chat.members;

  // Permissions check
  if (
    chat.groupChat &&
    chat.creator.toString() !== req.socketUserId.toString()
  ) {
    return next(
      new ErrorHandler("You are not allowed to delete this group", 403)
    );
  }

  if (!chat.groupChat && !chat.members.includes(req.socketUserId.toString())) {
    return next(
      new ErrorHandler("You are not allowed to delete this chat", 403)
    );
  }

  // Retrieve messages with attachments
  const messagesWithAttachments = await Message.find({
    chat: chatId,
    attachments: { $exists: true, $ne: [] },
  });

  // Delete attachments from Cloudinary
  const attachmentsToDelete = messagesWithAttachments.flatMap(
    (message: any) => message.attachments // An array of Cloudinary public_ids
  );

  if (attachmentsToDelete.length > 0) {
    try {
      const deleteResults = await deleteFilesFromCloudinary(
        attachmentsToDelete
      );
      console.log("Deleted attachments:", deleteResults);
    } catch (error) {
      return next(
        new ErrorHandler(`Error deleting attachments: ${error.message}`, 500)
      );
    }
  }

  // Delete messages from the database
  await Message.deleteMany({ chat: chatId });

  // Finally, delete the chat
  await Chat.findByIdAndDelete(chatId);

  res.status(200).json({
    success: true,
    message: "Chat and its messages have been successfully deleted",
  });
});

const getMessages = TryCatch(async (req: any, res: any, next: any) => {
  const chatId = req.params.id;
  const userId = req.socketUserId;
  const { page = 1 } = req.query;

  const resultPerPage = 20;
  const skip = (page - 1) * resultPerPage;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("chat not found", 404));

  if (!chat.members.includes(req.socketUserId.toString()))
    return next(new ErrorHandler("You are not allowed to view this chat", 403));

  const [messages, totalMessagesCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resultPerPage)
      .populate("sender", "name _id avatar")
      .lean(),
    Message.countDocuments({ chat: chatId }),
  ]);

  const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;
  const transformedMessages = messages.reverse().map((msg) => ({
    ...msg,
    sender: msg.sender._id.toString() === userId ? "You" : msg.sender.name,
    senderId: msg.sender._id.toString(),
    isUser: msg.sender._id.toString() === userId,
    avatar: msg.sender.avatar || "",
  }));

  res.status(200).json({
    success: true,
    messages: transformedMessages,
    totalPages,
    currentPage: Number(page),
    itemsOnPage: messages.length,
  });
});
const addMembers = TryCatch(async (req: any, res: any, next: any) => {
  const { chatId, members } = req.body;

  if (!members || members.length < 1)
    return next(new ErrorHandler("Members are required", 400));

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  if (chat.creator.toString() !== req.socketUserId)
    return next(new ErrorHandler("You are not allowed to add members", 403));

  const membersLimit = 100 - chat.members.length;
  if (membersLimit < 1)
    return next(new ErrorHandler("Members limit reached", 400));

  if (members.length > membersLimit)
    return next(
      new ErrorHandler(
        `you can only add at most ${membersLimit} members in this group chat`,
        400
      )
    );

  const allNewMembersPromise = members.map((i: any) =>
    UserForChat.findById(i, "name")
  );

  const allNewMembers = await Promise.all(allNewMembersPromise);

  const uniqueMembers = allNewMembers
    .filter((i) => !chat.members.includes(i._id.toString()))
    .map((i) => i._id);

  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100)
    return next(new ErrorHandler("Members limit reached", 400));

  await chat.save();

  const allUsersName = allNewMembers.map((i) => i.name).join(", ");

  emitEvent(req, GROUP_CHAT_ALERT, chat.members, {
    message: `${allUsersName} has been added in the group`,
    chatId,
  });

  emitEvent(req, REFETCH_CHATS, chat.members);

  res.status(200).json({
    success: true,
    message: "Members added successfully",
  });
});
const newGroupChat = TryCatch(async (req: any, res: any, next: any) => {
  const { name, members } = req.body;

  const allMembers = [...members, req.socketUserId];

  await Chat.create({
    name,
    groupChat: true,
    creator: req.socketUserId,
    members: allMembers,
  });

  const chat = await Chat.findOne({ name, members: allMembers });
  const chatId = chat._id;

  emitEvent(req, GROUP_CHAT_ALERT, allMembers, {
    message: `New group chat created: ${name}`,
    chatId,
  });
  emitEvent(req, REFETCH_CHATS, members);

  res.status(201).json({
    success: true,
    data: chat,
    message: "Group chat created successfully",
  });
});
const removeMember = TryCatch(async (req: any, res: any, next: any) => {
  const { userId, chatId } = req.body;

  const [chat, userThatWillBeRemoved] = await Promise.all([
    Chat.findById(chatId),
    UserForChat.findById(userId, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  if (chat.creator.toString() !== req.socketUserId.toString())
    return next(new ErrorHandler("You are not allowed to remove members", 403));

  if (chat.members.length <= 3)
    return next(
      new ErrorHandler(
        "You can't remove members from this group, group must have at least 3 members",
        400
      )
    );

  const allChatMembers = chat.members.map((i: any) => i.toString());

  chat.members = chat.members.filter(
    (member: any) => member.toString() !== userId.toString()
  );

  await chat.save();

  emitEvent(req, GROUP_CHAT_ALERT, chat.members, {
    message: `${userThatWillBeRemoved.name} has been removed from the group`,
    chatId,
  });

  emitEvent(req, REFETCH_CHATS, allChatMembers);

  res.status(200).json({
    success: true,
    message: "Member removed successfully",
  });
});
export {
  removeMember,
  addMembers,
  newGroupChat,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  sendAttachments,
};

import {
  ALERT,
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

const getMyChats = TryCatch(async (req: any, res: any, next: any) => {
  const chats = await Chat.find({ members: req.socketUserId }).populate(
    "members",
    "name avatar"
  );

  const transformedChats = chats.map(({ _id, name, members, groupChat }) => {
    const otherMember = getOtherMember(members, req.socketUserId);

    return {
      _id,
      groupChat,
      avatar: groupChat
        ? members
            .slice(0, 3)
            .map(({ avatar }: { avatar: { url: string } }) => avatar?.url || "")
        : [otherMember?.avatar?.url || ""], // 💡 fallback in case it's undefined
      name: groupChat ? name : otherMember?.name || "Unknown", // 💡 default name if missing
      members: members.reduce((prev: any, curr: any) => {
        if (curr._id.toString() !== req.socketUserId.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };
  });

  res.status(200).json({
    success: true,
    chats: transformedChats,
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
    let chat;

    return res.status(200).json({
      success: true,
      chat,
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
      .populate("sender", "name")
      .lean(),
    Message.countDocuments({ chat: chatId }),
  ]);

  const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;

  res.status(200).json({
    success: true,
    messages: messages.reverse(),
    totalPages,
  });
});

export { deleteChat, getChatDetails, getMessages, getMyChats, sendAttachments };

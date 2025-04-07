
import { logger } from "../utils/";
import { Notification } from "../models/notifications";
import { Types } from "mongoose";

interface CreateNotificationParams {
  userId: Types.ObjectId | string;
  title: string;
  message: string;
  type?: "info" | "warning" | "alert";
  metadata?: Record<string, any>;
}

export async function createNotification({
  userId,
  title,
  message,
  type = "info",
  metadata = {},
}: CreateNotificationParams): Promise<void> {
  try {
    const notification = new Notification({
      user: userId,
      title,
      message,
      type,
      metadata,
    });

    await notification.save();
    logger.info("Notification created successfully! 🎉");
  } catch (error) {
    logger.error("Error creating notification 💔:", error.message);
  }
}

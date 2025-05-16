import mongoose, { Schema, Types, model } from "mongoose";

const schema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["info", "warning", "alert", "reminder", "success", "group_join_request"],
      default: "info",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Notification =
  mongoose.models.Notification || model("Notification", schema);

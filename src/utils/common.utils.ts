import crypto, { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import {
  EXPIRATION_TIME,
  HTTP_STATUS,
  NODE_ENVS,
  ONE_MIN_MS,
  OTP_LENGTH,
  TOKEN_LENGTH,
  TOKEN_EXPIRATION,
} from "../constants";
import { Request, Response, NextFunction } from "express";
import { PricingTerm } from "../interfaces";
import { config } from "dotenv";
import { configs } from "../config";
import { ApiError } from "../errors";

/**
 * @description : For set success response data
 * @param message
 * @param data
 * @returns : Set success response data
 */
export const handleResponse = (
  message = "SUCCESS",
  data: unknown = null,
  statusCode: number = HTTP_STATUS.OK
) => {
  return {
    status: true,
    data: data,
    message: message,
    statusCode,
  };
};

export const parseCoverImages = (obj: any) => {
  if (obj && typeof obj.coverImages === "string") {
    obj.coverImages = JSON.parse(obj.coverImages);
  }
};

export function calculatePricing(
  pricing: PricingTerm[],
  dateRangeInDays: number
): number {
  // Ensure Day term is present
  const dayTerm = pricing.find((term) => term.term === "Day");
  if (!dayTerm) {
    throw new Error("Day term pricing is mandatory.");
  }

  // Automatically calculate missing terms based on Day price
  const dayPrice = parseFloat(dayTerm.price as any);
  if (!pricing.find((term) => term.term === "Week")) {
    pricing.push({
      term: "Week",
      price: (dayPrice * 7).toFixed(2),
      minimum: "1",
    });
  }
  if (!pricing.find((term) => term.term === "Month")) {
    pricing.push({
      term: "Month",
      price: (dayPrice * 30).toFixed(2),
      minimum: "1",
    });
  }
  if (!pricing.find((term) => term.term === "Year")) {
    pricing.push({
      term: "Year",
      price: (dayPrice * 365).toFixed(2),
      minimum: "1",
    });
  }

  // Sort terms for correct application
  const terms = pricing.sort((a, b) => {
    const order = { Day: 1, Week: 2, Month: 3, Year: 4 };
    return order[a.term] - order[b.term];
  });

  // Calculate the price
  let totalPrice = 0;
  for (const term of terms) {
    const termPrice = parseFloat(term.price);
    if (term.term === "Day" && dateRangeInDays <= 6) {
      totalPrice = dateRangeInDays * termPrice;
      break;
    } else if (term.term === "Week" && dateRangeInDays >= 7) {
      const weeks = Math.floor(dateRangeInDays / 7);
      const extraDays = dateRangeInDays % 7;
      const weeklyRate = termPrice;
      const dailyRate = weeklyRate / 7;
      totalPrice = weeks * weeklyRate + extraDays * dailyRate;
      break;
    } else if (term.term === "Month" && dateRangeInDays >= 30) {
      const months = Math.floor(dateRangeInDays / 30);
      const extraDays = dateRangeInDays % 30;
      const monthlyRate = termPrice;
      const dailyRate = monthlyRate / 30;
      totalPrice = months * monthlyRate + extraDays * dailyRate;
      break;
    } else if (term.term === "Year" && dateRangeInDays >= 365) {
      const years = Math.floor(dateRangeInDays / 365);
      const extraDays = dateRangeInDays % 365;
      const yearlyRate = termPrice;
      const dailyRate = yearlyRate / 365;
      totalPrice = years * yearlyRate + extraDays * dailyRate;
      break;
    }
  }

  return Number(totalPrice.toFixed(2));
}

export function parseJsonFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    fields.forEach((field) => {
      if (req.body[field] && typeof req.body[field] === "string") {
        try {
          req.body[field] = JSON.parse(req.body[field]);
        } catch (err) {
          return res.status(422).json({
            status: false,
            message: `${field} must be a valid JSON string`,
          });
        }
      }
    });
    return next();
  };
}

export const getTime = (
  value: number = EXPIRATION_TIME.OTP,
  duration: "min" | "hour" = "min",
  operation: "add" | "substract" = "add"
) => {
  const milliseconds =
    duration === "min" ? value * ONE_MIN_MS : value * 60 * ONE_MIN_MS;
  if (operation === "add") {
    return new Date(Date.now() + milliseconds);
  } else {
    return new Date(Date.now() - milliseconds);
  }
};

export const generateToken = (
  payload: { userId: string; newEmail: string },
  expiresIn: string = "1h"
) => {
  // Handle expiration time
  const expirationDate = new Date();
  const expirationTime = convertToMilliseconds(expiresIn);
  expirationDate.setTime(expirationDate.getTime() + expirationTime);

  // Generate a random token
  const token = encrypt(JSON.stringify(payload));

  // Combine token with user data and expiration time (this will be your payload)
  const payloadWithExpiration = {
    token,
    userId: payload.userId,
    newEmail: payload.newEmail,
    expiresAt: expirationDate.toISOString(), // Add expiration time to the payload
  };

  return payloadWithExpiration;
};

export const verifyToken = (token: string) => {
  // Decrypt the token
  const decryptedToken = decrypt(token);

  // Extract the expiration date from the payload
  const payload = JSON.parse(decryptedToken);

  return payload;
};

// Convert human-readable time to milliseconds (e.g., "1h" -> 3600000ms)
const convertToMilliseconds = (expiresIn: string) => {
  const match = expiresIn.match(/(\d+)([smhd])/);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000; // seconds
    case "m":
      return value * 60 * 1000; // minutes
    case "h":
      return value * 60 * 60 * 1000; // hours
    case "d":
      return value * 24 * 60 * 60 * 1000; // days
    default:
      return 0;
  }
};

export function encrypt(text: any) {
  const algorithm = "aes-256-ctr";
  const secretKey = configs.LINK_SECRET_KEY;
  const iv = randomBytes(16);

  // Ensure the secretKey is 32 bytes long
  const key = Buffer.alloc(32);
  Buffer.from(secretKey).copy(key);

  const cipher = createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

  return `${iv.toString("hex")}SHWCASE${encrypted.toString("hex")}`;
}
export function decrypt(encryptedText: any) {
  try {
    const algorithm = "aes-256-ctr";
    const secretKey = configs.LINK_SECRET_KEY;

    // Ensure the encryptedText is valid
    if (
      !encryptedText ||
      typeof encryptedText !== "string" ||
      !encryptedText.includes("SHWCASE")
    ) {
      throw new Error("Invalid input for decryption");
    }

    const parts = encryptedText.split("SHWCASE");
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = Buffer.from(parts[1], "hex");

    const key = Buffer.alloc(32);
    Buffer.from(secretKey).copy(key);

    const decipher = createDecipheriv(algorithm, key, iv);

    // Decrypt the text
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString();
  } catch (error) {
    // Handle known and unknown errors
    if (error instanceof Error) {
      throw new ApiError(
        error.message || "Decryption failed due to an unknown error.",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // If it's not an instance of Error, something went wrong
    throw new ApiError(
      "An unexpected error occurred during decryption",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

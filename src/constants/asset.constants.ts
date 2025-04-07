export const ALLOWED_IMG_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/tiff",
  "image/png",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/3gpp",
];

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
];

export enum MAX_FILES_COUNTS {
  FIVE = 5,
  TEN = 10,
}

export const MULTER_ERROR: Record<string, string> = {
  LIMIT_PART_COUNT: "Number of parts exceeds the specified limit.",
  LIMIT_FILE_SIZE: "File exceeds the specified size limit.",
  LIMIT_FILE_COUNT: "The number of files exceeds the specified limit",
  LIMIT_FIELD_KEY:
    "Field key or name does not meet certain criteria or exceeds a specified limit",
  LIMIT_UNEXPECTED_FILE:
    "Unexpected file is encountered, Check files length or field Name",
};

export enum FILE_FIELDS {
  FILE = "file",
  IMAGE = "images",
  COVER = "cover",
  PROFILE = "profile",
  VIDEO = "videos",
  SINGLE_IMAGE="image",
  THUMBNAIL= "thumbnails",
}

export enum CLOUD_FOLDERS {
  POST = "Post",
  EVENT = "Event",
  SPACE = "Space",
  FILES = "Files",
  AMENITY = "Amenity",
  USER = "FusionUser",
}

export const imageExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".webp",
];

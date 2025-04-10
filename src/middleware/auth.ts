import jwt, { JwtPayload } from "jsonwebtoken";
import { UserForChat } from "../models/";
import { ErrorHandler, logger } from "../utils";
import { TryCatch } from "./error";
import { UnAuthorizedError } from "../errors";
import { CHAT_COOKIE } from "../constants";
const isAuthenticated = TryCatch((req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) throw new Error("Token not found");

  const decodedData = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

  req.socketUserId = decodedData._id;
  return next();
});

const socketAuthenticator = async (error: any, socket: any, next: any) => {
  try {
    if (error) return next(error);

    const authToken = socket.request.headers.authorization?.split(" ")[1] ||   socket.handshake.auth.token;
    

    if (!authToken) throw new Error("Token not found");

    const decodedData = jwt.verify(
      authToken,
      process.env.JWT_SECRET
    ) as JwtPayload;

    const user = await UserForChat.findById(decodedData._id);

    if (!user) return next(new ErrorHandler("User not authenticated", 401));

    socket.userId = user;

    return next();
  } catch (error) {
    logger.error(
      `Error in Socket checkJwt middleware: ${(error as Error)?.message}`
    );
    return next(new UnAuthorizedError());
  }
};

export { isAuthenticated, socketAuthenticator };

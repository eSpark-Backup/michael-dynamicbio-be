import { Router } from "express";

import { checkJwt, validateRoles } from "../../middleware";
import { router as UserRoutes } from "./user";
import { router as chatRoute } from "./chat";
import { ROLES } from "../../constants";
const ChatRouter = Router();

ChatRouter.get("/", (req, res) => {
  res.json({ message: "Welcome to the Socket API For SHWCASE" });
});

ChatRouter.use("/user", UserRoutes);
ChatRouter.use("/", chatRoute);
export { ChatRouter };

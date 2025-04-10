import { Router } from "express";
import { router as authRoutes } from "./auth.routes";
import { checkJwt, validateRoles } from "../../middleware";
import { router as UserRoutes } from "./user.routes";
import { router as PostRoutes } from "./post.routes";
import { router as BondRoutes } from "./bond.routes";
import { router as InteractionRoutes } from "./interaction.routes";

import { ROLES } from "../../constants";
const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the API!" });
});
router.use("/auth", authRoutes);
router.use("/user", UserRoutes);
router.use("/post", PostRoutes);
router.use("/bond", BondRoutes);
router.use("/interaction", InteractionRoutes);

export { router };

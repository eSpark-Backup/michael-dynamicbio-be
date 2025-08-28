import express, { Router } from "express";
import {
  getMyProfile,
  login,
  newUser,
  searchUser,
  sendFriendRequest,
  acceptFriendRequest,
  getMyNotifications,
  getMyFriends,
} from "../../controllers";
import { isAuthenticated, singleAvatar } from "../../middleware";
import {
  acceptRequestValidator,
  loginValidator,
  registerValidator,
  sendRequestValidator,
  validateHandler,
} from "../../lib";
const router = Router();

// register new user
// app.post("/new", singleAvatar, registerValidator(), validateHandler, newUser);
router.post("/new", registerValidator(), validateHandler, newUser);

// login
router.post("/login", loginValidator(), validateHandler, login);

// After here user must be authenticated

router.use(isAuthenticated);
//make user validaiton pleaseee

// get my profile
router.get("/me", getMyProfile);

// logout

// search other users (not friends)
router.get("/search", searchUser);

// send friend request
router.put(
  "/sendrequest",
  sendRequestValidator(),
  validateHandler,
  sendFriendRequest
);

// accept friend request
router.put(
  "/acceptrequest",
  acceptRequestValidator(),
  validateHandler,
  acceptFriendRequest
);

// get my notifications
router.get("/notifications", getMyNotifications);

// get my friends & available friends to add in a group chat (who are not in the group chat)
router.get("/friends", getMyFriends);

export { router };

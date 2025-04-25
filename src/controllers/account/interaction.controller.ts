import { NextFunction, Response } from "express";
import { Repository } from "typeorm";
import { Bond, Comments, EntityType, Likes } from "../../entity";
import { Post } from "../../entity";
import { User } from "../../entity";
import { ICustomRequest } from "@/interfaces";
import { ApiError } from "../../errors";
import { handleResponse, logger } from "../../utils";
import { HTTP_STATUS } from "../../constants";

export class InteractionController {
  constructor(
    private usersRepo: Repository<User>,
    private postRepo: Repository<Post>,
    private likeRepo: Repository<Likes>,
    private commentRepo: Repository<Comments>,
    private bondsRepo: Repository<Bond>
  ) {}

  async toggleLike(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { entityId, type } = req.body;
    const userId = req.user.id;

    try {
      let entity;

      switch (type) {
        case EntityType.POST:
          entity = await this.postRepo.findOne({ where: { id: entityId } });
          if (!entity)
            throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);
          break;
        case EntityType.COMMENT:
          entity = await this.commentRepo.findOne({ where: { id: entityId } });
          if (!entity)
            throw new ApiError("Comment not found", HTTP_STATUS.NOT_FOUND);
          break;
        default:
          throw new ApiError("Invalid entity type", HTTP_STATUS.BAD_REQUEST);
      }

      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (!user) throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);

      if (type === EntityType.POST) {
        const existingLike = await this.likeRepo
          .createQueryBuilder("like")
          .where("like.postId = :postId", { postId: entityId })
          .andWhere("like.userId = :userId", { userId })
          .getOne();

        if (existingLike) {
          await this.likeRepo.remove(existingLike);
          res
            .status(HTTP_STATUS.OK)
            .json(handleResponse("Like removed successfully"));
        } else {
          const newLike = this.likeRepo.create({
            entityType: type,
            post: entity as Post,
            user,
          });
          await this.likeRepo.save(newLike);

          res
            .status(HTTP_STATUS.CREATED)
            .json(handleResponse("Like added successfully"));
        }
      } else if (type === EntityType.COMMENT) {
        const existingLike = await this.likeRepo
          .createQueryBuilder("like")
          .where("like.commentId = :commentId", { commentId: entityId })
          .andWhere("like.userId = :userId", { userId })
          .getOne();

        if (existingLike) {
          await this.likeRepo.remove(existingLike);
          res
            .status(HTTP_STATUS.OK)
            .json(handleResponse("Like removed successfully"));
        } else {
          const newLike = this.likeRepo.create({
            entityType: type,
            comments: entity as Comments,
            user,
          });
          await this.likeRepo.save(newLike);

          res
            .status(HTTP_STATUS.CREATED)
            .json(handleResponse("Like added successfully"));
        }
      }
    } catch (error) {
      logger.error(`Error in toggleLike: ${(error as Error)?.message}`);
      return next(error);
    }
  }

  async createCommentOnPost(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { content, postId, parentCommentId } = req.body;
    const userId = req.user.id;

    try {
      const post = await this.postRepo.findOne({ where: { id: postId } });
      if (!post) throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);

      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (!user) throw new ApiError("User not found", HTTP_STATUS.NOT_FOUND);
      let newComment = new Comments();
      newComment.content = content;
      newComment.post = post;
      newComment.user = user;
      if (parentCommentId) {
        const parentComment = await this.commentRepo.findOne({
          where: { id: parentCommentId },
        });
        if (!parentComment)
          throw new ApiError("Parent comment not found", HTTP_STATUS.NOT_FOUND);
        newComment.parentComment = parentComment;
      }

      await this.commentRepo.save(newComment);

      res
        .status(HTTP_STATUS.CREATED)
        .json(handleResponse("Comment created successfully"));
    } catch (error) {
      logger.error(
        `Error in createCommentOnPost: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }

  async getCommentsByPostId(
    req: ICustomRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const { postId } = req.params;
    const userId = req.user?.id;

    try {
      const post = await this.postRepo.findOne({ where: { id: postId } });
      if (!post) {
        throw new ApiError("Post not found", HTTP_STATUS.NOT_FOUND);
      }

      const comments = await this.commentRepo
        .createQueryBuilder("comment")
        .leftJoinAndSelect("comment.replies", "reply")
        .leftJoinAndSelect("comment.user", "user")
        .leftJoinAndSelect("reply.user", "replyUser")
        .leftJoinAndSelect("comment.likes", "like")
        .leftJoinAndSelect("like.user", "likeUser")

        .leftJoinAndSelect("reply.likes", "replyLike")
        .where("comment.postId = :postId", { postId })
        .select([
          "comment",
          "user.id",
          "user.firstName",
          "user.lastName",
          "user.email",
          "user.profileImage",
          "user.role",
          "user.company",
          "user.designation",
          "user.industry",
          "reply",
          "replyUser.id",
          "replyUser.firstName",
          "replyUser.lastName",
          "replyUser.profileImage",
          "replyUser.role",
          "replyUser.company",
          "replyUser.designation",
          "replyUser.industry",
          "replyUser.email",
          "like",
          "replyLike.id",
          "replyLike.userId",
          "likeUser.id",
          "likeUser.firstName",
          "likeUser.lastName",
          "likeUser.profileImage",
          "likeUser.role",
          "likeUser.company",
          "likeUser.designation",
          "likeUser.industry",
        ])
        .orderBy("comment.createdAt", "DESC")
        .getMany();

      const uniqueCommentsMap = new Map();
      const processedComments: Array<Record<string, any>> = [];

      comments.forEach( (comment) => {
    

        if (!uniqueCommentsMap.has(comment.id)) {
          uniqueCommentsMap.set(comment.id, true);
          const commentLikesCount = comment.likes ? comment.likes.length : 0;

          const filteredReplies = comment.replies.filter(
            (reply) => !uniqueCommentsMap.has(reply.id)
          );
          const processedReplies = filteredReplies.map((reply) => {
            const replyLikesCount = reply.likes ? reply.likes.length : 0;
            return {
              ...reply,
              likesCount: replyLikesCount, // Adding likes count to reply
            };
          });

          processedComments.push({
            ...comment,
            likesCount: commentLikesCount,

            replies: processedReplies, // Including processed replies
          });

          filteredReplies.forEach((reply) =>
            uniqueCommentsMap.set(reply.id, true)
          );
        }
      });
    for (const comment of processedComments) {
      for (const like of comment.likes) {
          const likeUserId = like.user.id;

          const bond = await this.bondsRepo.findOne({
            where: [
              { requester: { id: userId }, recipient: { id: likeUserId } },
              { requester: { id: likeUserId }, recipient: { id: userId } },
            ],
          });
            (like as any).isBond = !!bond; // true if bond exists, false otherwise
          }
          const bond = await this.bondsRepo.findOne({
            where: [
              { requester: { id: userId }, recipient: { id: comment.user.id } },
              { requester: { id: comment.user.id }, recipient: { id: userId } },
            ],
          });
            (comment as any).isBond = !!bond; // true if bond exists, false otherwise
        
        }
        
      
      res
        .status(HTTP_STATUS.OK)
        .json(
          handleResponse("Comments fetched successfully", processedComments)
        );
    } catch (error) {
      logger.error(
        `Error in getCommentsByPostId: ${(error as Error)?.message}`
      );
      return next(error);
    }
  }
}

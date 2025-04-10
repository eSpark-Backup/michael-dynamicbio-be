import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./users.entity";
import { Post } from "./post.entity";
import { Comments } from "./comments.entity";

export enum EntityType {
  POST = "POST",
  COMMENT = "COMMENT",
  GROUP = "GROUP",
  PAGE = "PAGE",
}

@Entity()
export class Likes extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: EntityType,
  })
  entityType: EntityType;

  @ManyToOne(() => Post, (post) => post.likes, {
    nullable: true,
    onDelete: "CASCADE",
  })
  post: Post;

  @ManyToOne(() => Comments, (comment) => comment.likes, { nullable: true })
  @JoinColumn({ name: "commentId" })
  comments: Comments;

  //   @ManyToOne(() => Group, (group) => group.likes, { nullable: true, onDelete: "CASCADE" })
  //   group: Group;

  //   @ManyToOne(() => Page, (page) => page.likes, { nullable: true, onDelete: "CASCADE" })
  //   page: Page;

  @ManyToOne(() => User, (user) => user.likes, { onDelete: "CASCADE" })
  user: User;
}

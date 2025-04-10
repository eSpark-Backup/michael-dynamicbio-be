import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { BaseEntity, Comments, Likes, User } from ".";

export enum PostStatus {
  ARCHIVE = "ARCHIVE",
  DRAFT = "DRAFT",
  PUBLISH = "PUBLISH",
}

export enum PostType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  ARTICLE = "ARTICLE",
  POLL = "POLL",
  EVENT = "EVENT",
}
export enum PostVisibility {
  PUBLIC = "PUBLIC",
  CONNECTIONS = "CONNECTIONS",
  ONLY_ME = "ONLY_ME",
  GROUPS = "GROUPS",
  FOLLOWERS = "FOLLOWERS",
}
@Entity()
export class Post extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: "CASCADE" })
  author: User;

  @Column({ type: "json", nullable: true })
  content: object;

  @Column({ type: "json", nullable: true })
  media: object;

  @OneToMany(() => Likes, (like) => like.post)
  likes: Likes[];

  @OneToMany(() => Comments, (comment) => comment.post)
  comments: Comments[]; 

  @Column({
    type: "enum",
    enum: PostType,
    default: PostType.TEXT,
  })
  type: PostType;

  @Column({
    type: "enum",
    enum: PostVisibility,
    default: PostVisibility.PUBLIC,
  })
  visibility: PostVisibility;

  @Column({ type: "varchar", length: 100, nullable: true })
  scheduledAt: string;

  @Column({
    type: "enum",
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;
}

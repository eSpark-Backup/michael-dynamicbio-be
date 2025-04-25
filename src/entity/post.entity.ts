import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from "typeorm";
import { BaseEntity, Comments, Likes, Page, Poll, Saved, User } from ".";

export enum PostStatus {
  ARCHIVE = "ARCHIVE",
  DRAFT = "DRAFT",
  PUBLISH = "PUBLISH",
  SCHEDULED = "SCHEDULED",
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
  PAGE = "PAGE",
  CUSTOM = "CUSTOM",
  FOLLOWERS = "FOLLOWERS",
}

export enum POLL_RESULT_VISIBILITY {
  ALWAYS = "ALWAYS", // Show results any time
  AFTER_VOTE = "AFTER_VOTE", // Show results only after user votes
  AFTER_END = "AFTER_END", // Show results only after poll ends
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

  @Column({ nullable: true, type: "timestamp" })
  scheduledFor: Date | null;

  @Column({ nullable: true, type: "varchar" })
  scheduledJobId: string;

  @OneToOne(() => Poll, (poll: Poll) => poll.post, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  poll: Poll | null;

  @ManyToOne(() => Page, (page) => page.posts, { nullable: true })
  page: Page;

  @Column({ nullable: true, type: "varchar" })
  pageId: string;

  @Column({ default: false, type: "boolean" })
  isPagePost: boolean;

  @OneToMany(() => Saved, (saved) => saved.post)
  savedByUsers: Saved[];
}

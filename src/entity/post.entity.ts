import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { BaseEntity, User } from ".";

export enum PostPrivacy {
  PUBLIC = "public",
  FRIENDS_ONLY = "friends_only",
  PRIVATE = "private",
}

export enum PostStatus {
  ARCHIVE = "ARCHIVE",
  DRAFT = "DRAFT",
  PUBLISH = "PUBLISH",
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

  @Column({
    type: "enum",
    enum: PostPrivacy,
    default: PostPrivacy.PUBLIC,
  })
  privacy: PostPrivacy;

  @Column({ type: "varchar", length: 100, nullable: true })
  scheduledAt: string;

  @Column({
    type: "enum",
    enum: PostStatus,
    default: PostStatus.DRAFT,
  })
  status: PostStatus;
}

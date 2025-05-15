import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { BaseEntity, Post, Group, User } from ".";

export enum PostRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}
@Entity()
export class GroupPostRequest extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.groupPostRequests, {
    onDelete: "CASCADE",
  })
  user: User;

  @ManyToOne(() => Group, (group) => group.groupPostRequests, {
    onDelete: "CASCADE",
  })
  group: Group;

  @ManyToOne(() => Post, (post) => post.groupPostRequests, {
    onDelete: "CASCADE",
  })
  post: Post;

  @Column({ type: "boolean", default: false })
  isApproved: boolean;

  @Column({
    type: "enum",
    enum: PostRequestStatus,
    default: PostRequestStatus.PENDING,
  })
  status: PostRequestStatus;

  @Column({ nullable: true, type: "text" })
  rejectionReason: string;
}

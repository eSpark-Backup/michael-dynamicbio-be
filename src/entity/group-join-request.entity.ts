import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
} from "typeorm";
import { Group } from "./group.entity";
import { User } from "./users.entity";
import { BaseEntity } from ".";


export enum GroupRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}
@Entity("group_join_requests")
export class GroupJoinRequest extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Group, (group) => group.groupJoinRequests, { onDelete: "CASCADE" })
  group: Group;

  @Column()
  groupId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column()
  userId: string;

  @Column({ default: false })
  isApproved: boolean;




  @Column({
      type: "enum",
      enum: GroupRequestStatus,
      default: GroupRequestStatus.PENDING,
    })
    status: GroupRequestStatus;
}

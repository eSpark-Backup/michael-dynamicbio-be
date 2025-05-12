import {
  Entity,
  BaseEntity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
} from "typeorm";
import { Group } from "./group.entity";
import { User } from "./users.entity";

@Entity("group_join_requests")
export class GroupJoinRequest extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Group, { onDelete: "CASCADE" })
  group: Group;

  @Column()
  groupId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user: User;

  @Column()
  userId: string;

  @Column({ default: false })
  isApproved: boolean;
}

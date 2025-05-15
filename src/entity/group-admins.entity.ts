import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Column,
} from "typeorm";
import { BaseEntity, Group, User } from ".";

@Entity("group_admins")
export class GroupAdmin extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Group, (group) => group.admins, {
    onDelete: "CASCADE",
  })
  group: Group;

  @Column()
  groupId: string;

  @ManyToOne(() => User, {
    onDelete: "CASCADE",
  })
  admin: User; 

  @Column()
  adminId: string;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: "SET NULL",
  })
  createdBy: User; 

  @Column({ nullable: true })
  createdById: string;

}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from "typeorm";
import { BaseEntity, Post, User } from ".";

export enum GroupIndustryType {
  PRODUCTION = "PRODUCTION",
  TRANSPORTATION = "TRANSPORTATION",
  STORAGE = "STORAGE",
  TECHNOLOGY = "TECHNOLOGY",
  FINANCE = "FINANCE",
  EDUCATION = "EDUCATION",
  HEALTHCARE = "HEALTHCARE",
  RETAIL = "RETAIL",
  OTHER = "OTHER",
}

export enum GroupStatus {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

@Entity("groups")
export class Group extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ nullable: false })
  address: string;


  @Column({
    type: "enum",
    enum: GroupIndustryType,
    default: GroupIndustryType.TECHNOLOGY,
  })
  industry: GroupIndustryType;

  @Column({ type: "text", nullable: true })
  rules: string;
  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  coverImageUrl: string;

  @Column({ nullable: true })
  logoPublicId: string;

  @Column({ nullable: true })
  coverImagePublicId: string;

  @ManyToOne(() => User)
  creator: User;

  @Column()
  creatorId: string;

  @Column({ default: true })
  allowMemberInvites: boolean;

  @Column({ default: true })
  requirePostApproval: boolean;

  @Column({
    type: "enum",
    enum: GroupStatus,
    default: GroupStatus.PUBLIC,
  })
  status: GroupStatus;

  @ManyToMany(() => User)
  @JoinTable({
    name: "group_admins",
    joinColumn: { name: "group_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  admins: User[];

  @ManyToMany(() => User)
  @JoinTable({
    name: "group_followers",
    joinColumn: { name: "group_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "user_id", referencedColumnName: "id" },
  })
  followers: User[];

  @OneToMany(() => Post, (post) => post.group)
  posts: Post[];
}

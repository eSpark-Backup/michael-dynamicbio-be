/* eslint-disable prettier/prettier */
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    Unique,
  } from "typeorm";
  import { User } from "./users.entity";
import { BaseEntity } from "./base.entity";
  
  export enum BondStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    BLOCKED = "blocked",
    CANCELED = "canceled",
  }
  
  @Entity()
  @Unique(["requester", "recipient"])
  export class Bond extends BaseEntity{
    @PrimaryGeneratedColumn("uuid")
    id: string;
  
    @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
    @Index()
    requester: User;
  
    @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
    @Index()
    recipient: User;
  
    @Column({
      type: "enum",
      enum: BondStatus,
      default: BondStatus.PENDING,
    })
    status: BondStatus;
  
  
  

  }
  
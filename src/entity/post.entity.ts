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
  
  

  }
  
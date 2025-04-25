import {
    Entity,
    PrimaryGeneratedColumn,
    ManyToOne,
    CreateDateColumn,
    Column,
  } from "typeorm";
  import { User, Post, BaseEntity } from ".";
  
  export enum SavedType {
    POST = "POST",
    EVENT = "EVENT",
    USER = "USER",
    PAGE = "PAGE",
  }
  
  @Entity()
  export class Saved extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;
  
    @ManyToOne(() => User, (user) => user.id, { onDelete: "CASCADE" })
    user: User;
  
    @ManyToOne(() => Post, (post) => post.id, { onDelete: "CASCADE" })
    post: Post;
  
    @Column({
      type: "enum",
      enum: SavedType,
      default: SavedType.POST,
    })
    type: SavedType;
  }
  
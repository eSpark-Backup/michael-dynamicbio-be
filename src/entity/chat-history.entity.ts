// chat-history.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity, User } from './';

@Entity()
export class ChatHistory extends BaseEntity {
  @PrimaryGeneratedColumn()
  @Index()
  id: number;

  @ManyToOne(() => User, (user) => user.chatHistory, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'text' })
  answer: string;

 
}

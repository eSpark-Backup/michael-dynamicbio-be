import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User,Post,Likes } from '.';


@Entity()
export class Comments {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({type: "varchar"})
  content: string;  

  @ManyToOne(() => User, (user) => user.comments)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Post, (post) => post.comments, { nullable: true })
  @JoinColumn({ name: 'postId' })
  post: Post;  

  @ManyToOne(() => Comments, (comment) => comment.replies, { nullable: true })
  @JoinColumn({ name: 'parentCommentId' })
  parentComment: Comments; 

  @OneToMany(() => Likes, (like) => like.comments)
  likes: Likes[]; 

  @OneToMany(() => Comments, (comment) => comment.parentComment)
  replies: Comments[];  
}

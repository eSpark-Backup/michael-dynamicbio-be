import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Post, User } from ".";
import { PollVote } from "./poll-vote.entity";

@Entity("polls")
export class Poll {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    question: string;

    @Column("simple-array")
    options: string[];

    @Column({ type: "timestamp", nullable: true })
    endDate: Date | null;

    @Column({ default: false })
    allowMultipleVotes: boolean;

    @Column({ default: true })
    showResults: boolean;

    @Column({ default: false })
    isAnonymous: boolean;

    @Column({ default: false })
    allowAddOptions: boolean;

    @ManyToOne(() => Post, (post) => post.poll, { onDelete: "CASCADE" })
    @JoinColumn({ name: "post_id" })
    post: Post;

    @Column({ name: "post_id" })
    postId: string;

    @OneToMany(() => PollVote, (vote) => vote.poll)
    votes: PollVote[];
}
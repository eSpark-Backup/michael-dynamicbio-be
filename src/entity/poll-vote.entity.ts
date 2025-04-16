import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Poll, User } from ".";

@Entity("poll_votes")
export class PollVote {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    optionIndex: number;

    @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    createdAt: Date;

    @ManyToOne(() => Poll, (poll) => poll.votes, { onDelete: "CASCADE" })
    @JoinColumn({ name: "poll_id" })
    poll: Poll;

    @Column({ name: "poll_id" })
    pollId: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user: User;

    @Column({ name: "user_id" })
    userId: string;
}
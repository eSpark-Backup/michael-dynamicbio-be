import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1744018736411 implements MigrationInterface {
    name = 'Migration1744018736411'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`bond\` (\`createdAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`status\` enum ('pending', 'accepted', 'rejected', 'blocked', 'canceled') NOT NULL DEFAULT 'pending', \`requesterId\` varchar(36) NULL, \`recipientId\` varchar(36) NULL, INDEX \`IDX_a7ca445f9a89601abfd89349dc\` (\`requesterId\`), INDEX \`IDX_ed60ed6e8bcf03722814834a8a\` (\`recipientId\`), UNIQUE INDEX \`IDX_57f80274c288216aa9ca41a08e\` (\`requesterId\`, \`recipientId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`bond\` ADD CONSTRAINT \`FK_a7ca445f9a89601abfd89349dc6\` FOREIGN KEY (\`requesterId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`bond\` ADD CONSTRAINT \`FK_ed60ed6e8bcf03722814834a8a7\` FOREIGN KEY (\`recipientId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`bond\` DROP FOREIGN KEY \`FK_ed60ed6e8bcf03722814834a8a7\``);
        await queryRunner.query(`ALTER TABLE \`bond\` DROP FOREIGN KEY \`FK_a7ca445f9a89601abfd89349dc6\``);
        await queryRunner.query(`DROP INDEX \`IDX_57f80274c288216aa9ca41a08e\` ON \`bond\``);
        await queryRunner.query(`DROP INDEX \`IDX_ed60ed6e8bcf03722814834a8a\` ON \`bond\``);
        await queryRunner.query(`DROP INDEX \`IDX_a7ca445f9a89601abfd89349dc\` ON \`bond\``);
        await queryRunner.query(`DROP TABLE \`bond\``);
    }

}

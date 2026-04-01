import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersAndApiKeys1775005768016 implements MigrationInterface {
    name = 'CreateUsersAndApiKeys1775005768016'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create users table
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "email" character varying NOT NULL,
                "hashedPassword" character varying NOT NULL,
                "displayName" character varying,
                "role" character varying NOT NULL DEFAULT 'user',
                "isActive" boolean NOT NULL DEFAULT true,
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_651689874e45e23b7eb9b6c5f6" ON "users" ("created_at") `);

        // Create api_keys table
        await queryRunner.query(`
            CREATE TABLE "api_keys" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "key" character varying NOT NULL,
                "hashedKey" character varying NOT NULL,
                "name" character varying NOT NULL,
                "prefix" character varying,
                "lastUsedAt" TIMESTAMP,
                "totalRequests" integer NOT NULL DEFAULT '0',
                "isActive" boolean NOT NULL DEFAULT true,
                "expiresAt" TIMESTAMP,
                "userId" uuid NOT NULL,
                CONSTRAINT "UQ_50e21f10a436b6029c710b96f73" UNIQUE ("key"),
                CONSTRAINT "PK_b1bd08e57fe5d628e6b1b7b136e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_b23e12e5c57ec5e2e3cf11436f" ON "api_keys" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD CONSTRAINT "FK_c6f7b0e67a9d8e962a4c6e9f4b3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Create request_logs table
        await queryRunner.query(`
            CREATE TABLE "request_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP,
                "endpoint" character varying NOT NULL,
                "method" character varying NOT NULL,
                "requestBody" jsonb,
                "responseBody" jsonb,
                "statusCode" integer NOT NULL,
                "model" character varying,
                "promptTokens" integer,
                "completionTokens" integer,
                "totalTokens" integer,
                "estimatedCost" double precision,
                "duration" integer NOT NULL,
                "ipAddress" character varying,
                "userAgent" character varying,
                "userId" uuid NOT NULL,
                "apiKeyId" uuid NOT NULL,
                CONSTRAINT "PK_6c65c2fbc15f960275a5c52a80e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_c05170a2d25b5b6ab36ec3a6c3" ON "request_logs" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_e13d0e6c7eb62e04c71ec3a13e" ON "request_logs" ("userId", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_a35e35c4c1a651164314ebc77e" ON "request_logs" ("apiKeyId", "created_at") `);
        await queryRunner.query(`ALTER TABLE "request_logs" ADD CONSTRAINT "FK_96d37d7a9a7e6f5b2f7f7c1a1d0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "request_logs" ADD CONSTRAINT "FK_9a08e6d1b9c7e5f3d4c4a2e8b1d" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "request_logs" DROP CONSTRAINT "FK_9a08e6d1b9c7e5f3d4c4a2e8b1d"`);
        await queryRunner.query(`ALTER TABLE "request_logs" DROP CONSTRAINT "FK_96d37d7a9a7e6f5b2f7f7c1a1d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a35e35c4c1a651164314ebc77e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e13d0e6c7eb62e04c71ec3a13e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c05170a2d25b5b6ab36ec3a6c3"`);
        await queryRunner.query(`DROP TABLE "request_logs"`);
        await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_c6f7b0e67a9d8e962a4c6e9f4b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b23e12e5c57ec5e2e3cf11436f"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_651689874e45e23b7eb9b6c5f6"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
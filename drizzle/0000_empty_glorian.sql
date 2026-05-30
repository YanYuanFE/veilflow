CREATE TYPE "public"."distribution_status" AS ENUM('draft', 'deploying', 'deployed', 'funded', 'live', 'completed', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."distribution_type" AS ENUM('airdrop', 'disperse', 'vesting');--> statement-breakpoint
CREATE TABLE "distributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "distribution_type" NOT NULL,
	"creator" text NOT NULL,
	"chain_id" integer DEFAULT 11155111 NOT NULL,
	"token" text NOT NULL,
	"status" "distribution_status" DEFAULT 'draft' NOT NULL,
	"contract_address" text,
	"deploy_tx_hash" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theme" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "distributions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"distribution_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"handle" text NOT NULL,
	"input_proof" text NOT NULL,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_distribution_id_distributions_id_fk" FOREIGN KEY ("distribution_id") REFERENCES "public"."distributions"("id") ON DELETE cascade ON UPDATE no action;
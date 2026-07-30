CREATE TABLE "captchas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resposta" text NOT NULL,
	"ip_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streamers" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"twitch_url" text NOT NULL,
	"foto_url" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"sucesso" boolean DEFAULT false NOT NULL,
	"motivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"streamer_id" integer NOT NULL,
	"telefone" text NOT NULL,
	"twitch_user_id" text NOT NULL,
	"twitch_username" text NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_streamer_id_streamers_id_fk" FOREIGN KEY ("streamer_id") REFERENCES "public"."streamers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "captchas_ip_hash_criado_em_idx" ON "captchas" USING btree ("ip_hash","criado_em");--> statement-breakpoint
CREATE INDEX "captchas_expira_em_idx" ON "captchas" USING btree ("expira_em");--> statement-breakpoint
CREATE UNIQUE INDEX "streamers_nome_uq" ON "streamers" USING btree ("nome");--> statement-breakpoint
CREATE INDEX "vote_attempts_ip_hash_criado_em_idx" ON "vote_attempts" USING btree ("ip_hash","criado_em");--> statement-breakpoint
CREATE INDEX "votes_ip_hash_criado_em_idx" ON "votes" USING btree ("ip_hash","criado_em");--> statement-breakpoint
CREATE INDEX "votes_twitch_user_id_criado_em_idx" ON "votes" USING btree ("twitch_user_id","criado_em");--> statement-breakpoint
CREATE INDEX "votes_streamer_id_idx" ON "votes" USING btree ("streamer_id");--> statement-breakpoint
CREATE INDEX "votes_criado_em_idx" ON "votes" USING btree ("criado_em");
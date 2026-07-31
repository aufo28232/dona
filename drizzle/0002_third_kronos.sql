CREATE TABLE "configuracao" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"fase" text DEFAULT 'fechada' NOT NULL,
	"iniciada_em" timestamp with time zone,
	"termina_em" timestamp with time zone,
	"vencedor_id" integer,
	"anunciado_em" timestamp with time zone,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "captchas" DROP COLUMN "imagem_svg";
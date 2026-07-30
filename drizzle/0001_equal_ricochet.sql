-- Default temporário só pra permitir a coluna virar NOT NULL com linhas já
-- existentes (todas de captchas de teste/expirados, sem uso real). Toda
-- linha nova sempre manda um valor de verdade.
ALTER TABLE "captchas" ADD COLUMN "imagem_svg" text NOT NULL DEFAULT '';
ALTER TABLE "captchas" ALTER COLUMN "imagem_svg" DROP DEFAULT;
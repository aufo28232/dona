/** 1 voto a cada 2 horas por IP. */
export const COOLDOWN_MS = 2 * 60 * 60 * 1000

/** Ranking regenerado a cada 30 min (ISR). */
export const RANKING_REVALIDATE_SECONDS = 30 * 60

/** Captcha morre em 5 min. */
export const CAPTCHA_TTL_MS = 5 * 60 * 1000

/** Enviar o form em menos de 2s depois de receber o captcha = bot. */
export const MIN_FILL_MS = 2000

/** Rate limit de TENTATIVAS de voto (válidas ou não), por IP. */
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
export const ATTEMPT_LIMIT = 12

/** Rate limit de emissão de captcha, por IP. */
export const CAPTCHA_WINDOW_MS = 10 * 60 * 1000
export const CAPTCHA_LIMIT = 25

/** Cookie de sessão do login com a Twitch. Dura só o login, não o cooldown de voto. */
export const SESSION_COOKIE = 'melhor_membro_sessao'
export const SESSION_TTL_SECONDS = 6 * 60 * 60

/** Cookie curto que guarda o `state` do OAuth, só durante a ida-e-volta pra Twitch. */
export const OAUTH_STATE_COOKIE = 'melhor_membro_oauth_state'
export const OAUTH_STATE_TTL_SECONDS = 10 * 60

export const MEDALHAS = ['🥇', '🥈', '🥉'] as const

/** Legendas rotativas do líder — só zoeira. */
export const TITULOS_LIDER = [
  '👑 Queridinho da galera',
  '🔥 Tá pegando fogo, bicho',
  '💜 Dono do coração da live',
  '🚀 Subindo tipo foguete',
  '🏆 O escolhido da Dona',
] as const

/**
 * Erros de domínio — Igreja Conect (S00-T10).
 *
 * Convenção: services puros lançam `BusinessRuleError`/`ForbiddenError`/
 * `NotFoundError` (em vez de retornar boolean). Loaders do RR7
 * capturam e convertem em `Response` com o status apropriado.
 *
 * @see agents/AGENTS.md §5.2 (Padrão de error handling)
 */

/**
 * Erro de regra de negócio (RN violada). Status 422.
 */
export class BusinessRuleError extends Error {
  readonly statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}

/**
 * Acesso negado por RBAC fina. Status 403.
 * (Diferente de `Response(403)` que é usado por `assertCan*` em loader.)
 */
export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Recurso não encontrado. Status 404.
 */
export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Conflito de unicidade em email. Status 409.
 */
export class EmailDuplicadoError extends Error {
  readonly statusCode = 409;
  constructor(message = "Email já cadastrado") {
    super(message);
    this.name = "EmailDuplicadoError";
  }
}

/**
 * Conflito de unicidade em nome. Status 409.
 */
export class NomeDuplicadoError extends Error {
  readonly statusCode = 409;
  constructor(message = "Nome já cadastrado") {
    super(message);
    this.name = "NomeDuplicadoError";
  }
}

/**
 * Conflito genérico (ex: vínculo duplicado, estado inválido). Status 409.
 */
export class ConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = "Conflito de estado") {
    super(message);
    this.name = "ConflictError";
  }
}

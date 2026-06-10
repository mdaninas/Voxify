export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function errorResponse(res, error) {
  if (!(error instanceof AppError)) {
    console.error(error);
  }
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_SERVER_ERROR";
  const message =
    error instanceof AppError ? error.message : "Terjadi kesalahan tidak terduga pada server.";
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

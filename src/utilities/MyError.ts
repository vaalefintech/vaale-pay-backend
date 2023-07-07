class MyError extends Error {
  httpCode;
  constructor(message: string, httpCode: number) {
    super(message);
    this.name = "MyError";
    this.httpCode = httpCode;
  }
}

class NoAutorizadoException extends MyError {
  constructor(message: string) {
    super(message, 401);
  }
}
class NoExisteException extends MyError {
  constructor(message: string) {
    super(message, 204);
  }
}
class ParametrosIncompletosException extends MyError {
  constructor(message: string) {
    super(message, 400);
  }
}
class NoHayUsuarioException extends MyError {
  constructor(message: string) {
    super(message, 401);
  }
}
class MalaPeticionException extends MyError {
  constructor(message: string) {
    super(message, 400);
  }
}
class InesperadoException extends MyError {
  constructor(message: string) {
    super(message, 500);
  }
}

export {
  MyError,
  NoAutorizadoException,
  NoExisteException,
  ParametrosIncompletosException,
  NoHayUsuarioException,
  MalaPeticionException,
  InesperadoException,
};

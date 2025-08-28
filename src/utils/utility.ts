class ErrorHandler extends Error {
  [x: string]: any;
  constructor(message: any, statusCode: any) {
    super(message);
    this.statusCode = statusCode;
  }
}

export { ErrorHandler };

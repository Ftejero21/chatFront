export interface WsUserErrorDTO {
  code?: string;
  message?: string;
  destination?: string;
  retryAfterSeconds?: number;
  ts?: string;
  [key: string]: any;
}


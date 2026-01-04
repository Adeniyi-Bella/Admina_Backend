import { UserDTO } from './services/users/user.interface';

export interface IValues {
  max: number;
  min: number;
  current: number;
}

export interface IPlans {
  premium?: IValues;
  standard?: IValues;
  free?: IValues;
}

export interface BotDetectionResult {
  isBot: boolean;
  score: number;
  reasons: string[];
  meta: {
    browser: string;
    os: string;
    device: string;
    ip: string;
  };
}

export interface GuardianConfig {
  threshold: number;
}

export interface JobData {
  file: { originalname: string; mimetype: string; buffer: string };
  targetLanguage: string;
  user: UserDTO;
  docId: string;
}

export interface FileMulter {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer<ArrayBuffer>;
  size: number;
}

import { IUser } from './models/user.model';

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

export type UserDTO = Pick<IUser, 'userId' | 'plan' | 'lengthOfDocs'> & {
  email?: string;
};

export interface QuotaResetUser extends UserDTO {
  monthlyQuotaResetAt: Date;
}

export type VerifiedUser = Pick<IUser, 'userId' | 'email' | 'username'>;

export interface JobData {
  file: { originalname: string; mimetype: string; filePath: string };
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

export interface PollRequestReponse {
  docId: string;
  status: string;
  error?: string;
}

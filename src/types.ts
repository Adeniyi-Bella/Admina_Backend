export interface IValues {
  max: number;
  min: number;
  current: number
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
    // tlsVersion: string;
    ip: string;
  };
}

export interface GuardianConfig {
  threshold: number;
}
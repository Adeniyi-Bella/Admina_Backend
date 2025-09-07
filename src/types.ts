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

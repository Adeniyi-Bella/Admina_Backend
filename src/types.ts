export interface IValues {
  max: number;
  min: number;
  current: number
}

export interface IPlans {
  premium?: IValues;
  free?: IValues;
}
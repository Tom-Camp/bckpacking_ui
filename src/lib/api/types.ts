import type { components } from './schema';

type Schemas = components['schemas'];

export type User = Schemas['UserRead'];
export type UserUpdate = Schemas['UserUpdate'];
export type UserCreate = Schemas['UserCreate'];
export type Unit = Schemas['Unit'];

export type Trip = Schemas['TripRead'];
export type TripCreate = Schemas['TripCreate'];
export type TripUpdate = Schemas['TripUpdate'];
export type TripType = Schemas['TripType'];

export type ChecklistItem = Schemas['ChecklistItemRead'];
export type ChecklistItemKey = Schemas['ChecklistItemKey'];
export type ChecklistItemUpdate = Schemas['ChecklistItemUpdate'];
export type ChecklistStatus = Schemas['ChecklistStatus'];

export type GearItem = Schemas['GearItemRead'];
export type GearItemCreate = Schemas['GearItemCreate'];
export type GearItemUpdate = Schemas['GearItemUpdate'];
export type GearKind = Schemas['GearKind'];

export type TripGear = Schemas['TripGearRead'];
export type TripGearCreate = Schemas['TripGearCreate'];
export type TripGearUpdate = Schemas['TripGearUpdate'];

export type TripNote = Schemas['TripNoteRead'];

export type FoodPlan = Schemas['FoodPlannerRead'];
export type FoodPlanUpdate = Schemas['FoodPlannerUpdate'];
export type TripFood = Schemas['TripFoodRead'];
export type TripFoodCreate = Schemas['TripFoodCreate'];
export type TripFoodUpdate = Schemas['TripFoodUpdate'];
export type Meal = Schemas['Meal'];

export const TRIP_TYPES: TripType[] = ['loop', 'out-and-back', 'point-to-point'];
export const GEAR_KINDS: GearKind[] = ['base', 'worn', 'consumable'];
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

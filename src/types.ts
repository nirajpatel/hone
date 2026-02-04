export type BrewMethod = 'espresso' | 'pour over' | 'immersion';

export type CoffeeTemperature = 'room-temperature' | 'frozen';

export type RoastLevel = 'Light' | 'Medium-Light' | 'Medium' | 'Medium-Dark' | 'Dark';

export type EquipmentType = 'brewer' | 'grinder';

export interface Equipment {
  id: string;
  name: string; // Deprecated - kept for backwards compatibility
  company?: string;
  model?: string;
  type: EquipmentType;
  method: BrewMethod; // Deprecated for grinders - use methods array instead
  methods?: BrewMethod[]; // Array of brew methods this equipment supports (used for grinders)
  active: boolean;
  primary: boolean; // Deprecated - kept for backwards compatibility, use primaryForMethods instead
  primaryForMethods?: BrewMethod[]; // Array of brew methods this equipment is primary for
  userId: string;
  createdAt: string;
}

export interface BrewStage {
  endTime: number;
  endWeight: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  smsConsent?: boolean;
  householdId?: string;
  createdAt: string;
}

export interface Coffee {
  id: string;
  roaster: string;
  name: string;
  roastDate: string;
  region?: string;
  notes?: string;
  roastLevel?: RoastLevel;
  imageUrls?: string[];
  personalNotes?: string;
  createdAt: string;
}

export interface Brew {
  id: string;
  coffeeId: string;
  coffeeName: string;
  roaster: string;
  brewMethod: BrewMethod;
  grindSetting: string;
  dosage: number;
  brewTime: number;
  finalWeight: number;
  quality?: number;
  waterTemp?: number; // Water temperature in Fahrenheit
  coffeeTemperature: CoffeeTemperature;
  brewerId?: string; // Reference to brewer
  brewerName?: string; // Denormalized for display (updated when equipment is renamed)
  grinderId?: string; // Reference to grinder
  grinderName?: string; // Denormalized for display (updated when equipment is renamed)
  userId: string;
  userName: string;
  createdAt: string;
  stages?: BrewStage[];
  tastingNotes?: string;
  personalNotes?: string;
  localTimestamp?: string; // Local timestamp string for SMS display
  timezoneOffset: number; // Timezone offset in minutes for day boundary calculation (required)
  suggestion?: {
    concise: {
      goal: string; // 2-3 words (e.g., "Reduce sourness")
      action: string; // 2-4 words (e.g., "Grind finer")
      confidence: 'High' | 'Medium' | 'Low'; // Always generated, frontend filters display
    };
    full: {
      summary: string;
      primaryIssue: string;
      suggestions: Array<{
        parameter: string;
        action: string;
        effect: string;
        reasoning: string;
        confidence: 'High' | 'Medium' | 'Low';
      }>;
    };
  };
}
import { Brew, Coffee } from '../types';
import { StaticTimelineCard } from './StaticTimelineCard';

// Static coffee data
const staticCoffee1: Coffee = {
  id: 'static-coffee-1',
  roaster: 'Maru Coffee',
  name: 'Santo Blend',
  roastDate: '2025-12-15',
  createdAt: '2025-12-15T00:00:00Z',
};

// Static brew data for Maru Coffee – Santo Blend • Espresso (22 brews)
// Quality progression: bad → decent → exception (ending with exception)
const staticBrews1: Brew[] = [
  { id: 'b1', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '12', dosage: 18, brewTime: 28, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-10T08:00:00Z', timezoneOffset: -480 },
  { id: 'b2', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '11', dosage: 18, brewTime: 30, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-12T09:15:00Z', timezoneOffset: -480 },
  { id: 'b3', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '10', dosage: 18, brewTime: 32, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-14T10:30:00Z', timezoneOffset: -480 },
  { id: 'b4', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '9', dosage: 18, brewTime: 30, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-16T07:45:00Z', timezoneOffset: -480 },
  { id: 'b5', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '9', dosage: 18, brewTime: 28, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-18T08:20:00Z', timezoneOffset: -480 },
  { id: 'b6', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '8', dosage: 18, brewTime: 30, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-20T09:00:00Z', timezoneOffset: -480 },
  { id: 'b7', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '8', dosage: 18, brewTime: 32, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-22T10:15:00Z', timezoneOffset: -480 },
  { id: 'b8', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '7', dosage: 18, brewTime: 30, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-24T08:30:00Z', timezoneOffset: -480 },
  { id: 'b9', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '7', dosage: 18, brewTime: 28, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-25T09:45:00Z', timezoneOffset: -480 },
  { id: 'b10', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '7', dosage: 18, brewTime: 30, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-26T07:20:00Z', timezoneOffset: -480 },
  { id: 'b11', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '6', dosage: 18, brewTime: 32, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-27T08:00:00Z', timezoneOffset: -480 },
  { id: 'b12', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '6', dosage: 18, brewTime: 30, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-28T09:30:00Z', timezoneOffset: -480 },
  { id: 'b13', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '6', dosage: 18, brewTime: 28, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-29T10:00:00Z', timezoneOffset: -480 }, // 10th from last (red)
  { id: 'b14', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 30, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-30T08:15:00Z', timezoneOffset: -480 }, // 9th from last (yellow)
  { id: 'b15', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 32, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-01-31T09:00:00Z', timezoneOffset: -480 }, // 8th from last (red)
  { id: 'b16', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 30, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-02-01T08:30:00Z', timezoneOffset: -480 }, // 7th from last (red)
  { id: 'b17', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 28, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-02-01T14:00:00Z', timezoneOffset: -480 }, // 6th from last (yellow)
  { id: 'b18', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 30, finalWeight: 36, quality: 1, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-02-02T08:00:00Z', timezoneOffset: -480 }, // 5th from last (red)
  { id: 'b19', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 32, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-02-02T12:00:00Z', timezoneOffset: -480 }, // 4th from last (yellow)
  { id: 'b20', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 30, finalWeight: 36, quality: 2, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-02-02T16:00:00Z', timezoneOffset: -480 }, // 3rd from last (yellow)
  { id: 'b21', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 28, finalWeight: 36, quality: 3, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-02-02T20:00:00Z', timezoneOffset: -480 }, // 2nd from last (green)
  { id: 'b22', coffeeId: 'static-coffee-1', coffeeName: 'Santo Blend', roaster: 'Maru Coffee', brewMethod: 'espresso', grindSetting: '5', dosage: 18, brewTime: 30, finalWeight: 36, quality: 3, coffeeTemperature: 'room-temperature', userId: 'static-user-1', userName: 'User', createdAt: '2026-02-02T22:00:00Z', timezoneOffset: -480, suggestion: { concise: { goal: 'Improve extraction', action: 'Increase temperature', confidence: 'High' }, full: { summary: 'Excellent balance achieved', primaryIssue: 'None', suggestions: [{ parameter: 'Temperature', action: 'Increase temperature', effect: 'Improve extraction', reasoning: 'Current recipe is dialed in', confidence: 'High' }] } } }, // Last (green)
];

export function StaticTimelineScreenshot() {
  return (
    <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0 16px 0' }}>
      <StaticTimelineCard coffee={staticCoffee1} brews={staticBrews1} />
    </div>
  );
}

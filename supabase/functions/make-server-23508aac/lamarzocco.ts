import * as kv from './kv_store.ts';

// Import La Marzocco library from npm
import {
  LaMarzoccoCloudClient,
  LaMarzoccoMachine,
  WidgetType,
  MachineMode,
  MachineStatus,
  MachineState,
  installationKeyFromJSON,
  Boiler,
} from "npm:node-lamarzocco";

/**
 * Machine status return type
 */
export interface MachineStatusInfo {
  serialNumber: string;
  name: string;
  modelName: string;
  connected: boolean;
  state: MachineState;
  mode: MachineMode;
  coffeeBoilerTemp?: number;
  steamBoilerTemp?: number;
}

/**
 * Get installation key from environment variable or KV store
 */
async function getInstallationKey() {
  // First try environment variable
  const keyEnv = Deno.env.get('LAMARZOCCO_INSTALLATION_KEY');
  if (keyEnv) {
    return installationKeyFromJSON(keyEnv);
  }
  
  // Fall back to KV store
  const keyJson = await kv.get('lamarzocco:installation_key');
  if (!keyJson) {
    throw new Error('La Marzocco installation key not found. Please set LAMARZOCCO_INSTALLATION_KEY environment variable or store in KV.');
  }
  return installationKeyFromJSON(JSON.stringify(keyJson));
}

/**
 * Get credentials from environment variables
 */
function getCredentials() {
  const username = Deno.env.get('LAMARZOCCO_USERNAME');
  const password = Deno.env.get('LAMARZOCCO_PASSWORD');
  
  if (!username || !password) {
    throw new Error('La Marzocco credentials not configured. Set LAMARZOCCO_USERNAME and LAMARZOCCO_PASSWORD environment variables.');
  }
  
  return { username, password };
}

/**
 * Get Machine Status
 * Returns a status object with all machine information
 */
export async function getMachineStatus(): Promise<MachineStatusInfo> {
  const { username, password } = getCredentials();
  const installationKey = await getInstallationKey();

  // Initialize cloud client
  const cloudClient = new LaMarzoccoCloudClient(
    username,
    password,
    installationKey
  );

  // Get machine
  const things = await cloudClient.listThings();
  const thing = things[0];
  const serialNumber = thing?.serialNumber;

  if (!serialNumber) {
    throw new Error('No La Marzocco machine found');
  }

  // Initialize machine and get dashboard
  const machine = new LaMarzoccoMachine(serialNumber, cloudClient);
  await machine.getDashboard();

  // Get machine status from dashboard
  const machineStatus = machine.dashboard.config[
    WidgetType.CM_MACHINE_STATUS
  ] as MachineStatus | undefined;

  if (!machineStatus) {
    throw new Error('Machine status widget not found in dashboard');
  }

  // Build status object
  const statusInfo: MachineStatusInfo = {
    serialNumber: serialNumber,
    name: thing?.name || serialNumber,
    modelName: machine.dashboard.modelName,
    connected: machine.dashboard.connected,
    state: machineStatus.status,
    mode: machineStatus.mode
  };

  // Add boiler temperatures if available
  const coffeeBoiler = machine.dashboard.config[
    WidgetType.CM_COFFEE_BOILER
  ] as Boiler | undefined;
  const steamBoiler = machine.dashboard.config[
    WidgetType.CM_STEAM_BOILER
  ] as Boiler | undefined;

  if (coffeeBoiler) {
    statusInfo.coffeeBoilerTemp = coffeeBoiler.targetTemperature;
  }
  if (steamBoiler) {
    statusInfo.steamBoilerTemp = steamBoiler.targetTemperature;
  }

  return statusInfo;
}

/**
 * Stream machine status updates via WebSocket
 * This returns an async generator that yields status updates
 */
export async function* streamMachineStatusUpdates() {
  const { username, password } = getCredentials();
  const installationKey = await getInstallationKey();

  // Initialize cloud client
  const cloudClient = new LaMarzoccoCloudClient(
    username,
    password,
    installationKey
  );

  // Get machine
  const things = await cloudClient.listThings();
  const thing = things[0];
  const serialNumber = thing?.serialNumber;
  
  if (!serialNumber) {
    throw new Error('No La Marzocco machine found');
  }

  const machine = new LaMarzoccoMachine(serialNumber, cloudClient);

  // Get initial status
  await machine.getDashboard();
  const initialStatus = machine.dashboard.config[
    WidgetType.CM_MACHINE_STATUS
  ] as MachineStatus;
  
  const initialCoffeeBoiler = machine.dashboard.config[
    WidgetType.CM_COFFEE_BOILER
  ] as Boiler | undefined;

  // Yield initial status
  yield {
    type: 'initial',
    timestamp: new Date().toISOString(),
    serialNumber,
    name: thing?.name || serialNumber,
    modelName: machine.dashboard.modelName,
    connected: machine.dashboard.connected,
    state: initialStatus?.status,
    mode: initialStatus?.mode,
    coffeeBoilerTemp: initialCoffeeBoiler?.targetTemperature,
  };

  // Stream control variables
  let streamActive = true;
  let updates: any[] = [];
  let resolveNext: ((value: any) => void) | null = null;

  let lastState: MachineState | null = null;
  let lastMode: MachineMode | null = null;
  let brewingStartTime: Date | null = null;

  // Connect to websocket with callbacks (don't await - it runs in background)
  machine.connectDashboardWebsocket(
    async (config) => {
      if (!streamActive) return;
      
      const timestamp = new Date().toISOString();
      
      // Get machine status from the update
      const machineStatus = config.config[
        WidgetType.CM_MACHINE_STATUS
      ] as MachineStatus | undefined;
      
      const coffeeBoiler = config.config[
        WidgetType.CM_COFFEE_BOILER
      ] as Boiler | undefined;

      if (machineStatus) {
        const currentState = machineStatus.status;
        const currentMode = machineStatus.mode;

        // Check if state or mode changed
        const stateChanged = currentState !== lastState;
        const modeChanged = currentMode !== lastMode;

        if (stateChanged || modeChanged) {
          const update: any = {
            timestamp,
            state: currentState,
            mode: currentMode,
            stateChanged,
            modeChanged,
            previousState: lastState,
            previousMode: lastMode,
            coffeeBoilerTemp: coffeeBoiler?.targetTemperature,
          };

          // Handle brewing state
          if (currentState === MachineState.BREWING && machineStatus.brewingStartTime) {
            brewingStartTime = new Date(machineStatus.brewingStartTime);
            update.type = 'brewing_started';
            update.brewingStartTime = brewingStartTime.toISOString();
          } else if (lastState === MachineState.BREWING && currentState === MachineState.POWERED_ON) {
            // Brew just completed - read final weight
            const brewData = machineStatus.lastCoffee || machineStatus.lastFlush || null;
            
            if (brewData) {
              const finalWeight = brewData.doseValue ?? 0;
              const finalDuration = brewData.extractionSeconds ?? 0;
              
              update.type = 'brewing_complete';
              update.brewDuration = finalDuration;
              update.brewWeight = finalWeight;
            } else {
              update.type = 'state_changed';
            }
            
            brewingStartTime = null;
          } else if (stateChanged) {
            update.type = 'state_changed';
          } else {
            update.type = 'mode_changed';
          }

          // Queue the update
          if (resolveNext) {
            resolveNext(update);
            resolveNext = null;
          } else {
            updates.push(update);
          }

          lastState = currentState;
          lastMode = currentMode;
        } else if (coffeeBoiler?.targetTemperature !== undefined) {
          // Even if state/mode didn't change, send temperature updates
          const update: any = {
            type: 'temperature_update',
            timestamp,
            state: currentState,
            mode: currentMode,
            coffeeBoilerTemp: coffeeBoiler.targetTemperature,
          };
          
          // Queue the update
          if (resolveNext) {
            resolveNext(update);
            resolveNext = null;
          } else {
            updates.push(update);
          }
        }
      }
    },
    () => {
      if (!streamActive) return;
      const update = {
        type: 'websocket_connected',
        timestamp: new Date().toISOString(),
      };
      if (resolveNext) {
        resolveNext(update);
        resolveNext = null;
      } else {
        updates.push(update);
      }
    },
    () => {
      if (!streamActive) return;
      const update = {
        type: 'websocket_disconnected',
        timestamp: new Date().toISOString(),
      };
      if (resolveNext) {
        resolveNext(update);
        resolveNext = null;
      } else {
        updates.push(update);
      }
    },
    true // Auto-reconnect
  );

  // Yield updates from the queue
  try {
    // Yield updates as they come
    while (streamActive) {
      // Check if we have queued updates first
      if (updates.length > 0) {
        const update = updates.shift();
        yield update;
      } else {
        // Wait for next update with timeout to allow cleanup checks
        const update = await Promise.race([
          new Promise<any>((resolve) => {
            resolveNext = resolve;
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 30000)
          )
        ]).catch(() => null);
        
        if (update) {
          yield update;
        }
      }
    }
  } finally {
    // Cleanup
    streamActive = false;
    
    // Disconnect websocket if machine has a disconnect method
    try {
      if (machine && typeof (machine as any).disconnectDashboardWebsocket === 'function') {
        (machine as any).disconnectDashboardWebsocket();
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}
import { EventEmitter } from 'events';
import type { Procxy } from './src/types/procxy.js';

class EventWorker extends EventEmitter {
  async startTask(duration: number): Promise<string> {
    return 'done';
  }
}

// Test if Procxy recognizes EventWorker as EventEmitter
type Test = EventWorker extends EventEmitter ? 'yes' : 'no'; // Should be 'yes'

// Test if the proxy has the on method
declare const proxy: Procxy<EventWorker>;
proxy.on('test', () => {}); // Should work

import { EventEmitter } from 'events';
import type { EventMessage } from '../shared/protocol.js';

/**
 * Event bridge that forwards EventEmitter events from child to parent.
 * Detects if an instance extends EventEmitter and sets up event forwarding.
 * Only forwards events that have been subscribed to by the parent (optimization).
 */
export class EventBridge {
  private instance: unknown;
  private sendToParent: (message: EventMessage) => void;
  private boundHandlers: Map<string | symbol, (...args: any[]) => void> = new Map();
  private subscribedEvents = new Set<string>();

  constructor(instance: unknown, sendToParent: (message: EventMessage) => void) {
    this.instance = instance;
    this.sendToParent = sendToParent;
  }

  /**
   * Check if the instance extends EventEmitter.
   */
  static isEventEmitter(instance: unknown): instance is EventEmitter {
    if (!instance || typeof instance !== 'object') {
      return false;
    }

    // Check if instance is or extends EventEmitter
    return instance instanceof EventEmitter;
  }

  /**
   * Set up event forwarding for an EventEmitter instance.
   * Captures all events and forwards them to the parent process ONLY if subscribed.
   */
  setup(): void {
    if (!EventBridge.isEventEmitter(this.instance)) {
      return;
    }

    // Intercept the emit method to forward events to parent (if subscribed)
    const originalEmit = this.instance.emit.bind(this.instance);

    this.instance.emit = (event: string | symbol, ...args: any[]): boolean => {
      // Call the original emit first (for local listeners in child)
      const result = originalEmit(event, ...args);

      // Only forward if this event is subscribed by the parent
      const eventName = typeof event === 'symbol' ? event.toString() : event;
      if (this.subscribedEvents.has(eventName)) {
        try {
          this.sendToParent({
            type: 'EVENT',
            eventName,
            args: args as any // Will be validated as Jsonifiable in serialization layer
          });
        } catch (error) {
          // Silently ignore forwarding errors to avoid breaking child process
          console.error('Failed to forward event to parent:', error);
        }
      }

      return result;
    };
  }

  /**
   * Subscribe to an event (start forwarding it to parent).
   */
  subscribeEvent(eventName: string): void {
    this.subscribedEvents.add(eventName);
  }

  /**
   * Unsubscribe from an event (stop forwarding it to parent).
   */
  unsubscribeEvent(eventName: string): void {
    this.subscribedEvents.delete(eventName);
  }

  /**
   * Clean up event forwarding.
   */
  teardown(): void {
    // Event forwarding is handled via emit override, no cleanup needed
    this.boundHandlers.clear();
    this.subscribedEvents.clear();
  }
}

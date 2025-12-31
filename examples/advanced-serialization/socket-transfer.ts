/**
 * Example: Socket Transfer with Handle Passing
 *
 * Demonstrates transferring network sockets between parent and child processes.
 * Requires supportHandles: true option (Node.js feature, Unix/Linux only).
 *
 * IMPORTANT: This only works on Unix/Linux systems, NOT on Windows.
 */

import { procxy } from '../../src/index.js';
import * as net from 'net';
import { fileURLToPath } from 'node:url';

/**
 * Socket handler that receives and processes connections
 */
class SocketHandler {
  private connections = new Map<string, net.Socket>();

  /**
   * Register a received socket connection
   */
  registerConnection(id: string, socket: net.Socket): void {
    this.connections.set(id, socket);
    console.log(`  [Child] Registered connection ${id}`);

    socket.on('data', (data) => {
      console.log(`  [Child] Received data on ${id}: ${data.toString().trim()}`);
      socket.write(`Echo: ${data}`);
    });

    socket.on('end', () => {
      console.log(`  [Child] Connection ${id} ended`);
      this.connections.delete(id);
    });

    socket.on('error', (err) => {
      console.error(`  [Child] Socket ${id} error:`, err.message);
      this.connections.delete(id);
    });
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const [id, socket] of this.connections.entries()) {
      socket.end();
      console.log(`  [Child] Closed connection ${id}`);
    }
    this.connections.clear();
  }
}

async function main() {
  console.log('🔌 Socket Transfer Example\n');

  // Check platform
  if (process.platform === 'win32') {
    console.warn('⚠️  Handle passing is not supported on Windows');
    console.log('This example will not work on Windows systems.');
    console.log('Please run on Unix/Linux/macOS.');
    return;
  }

  // Create handler with handle passing support
  console.log('Creating SocketHandler with handle passing support...');
  await using handler = await procxy(SocketHandler, {
    modulePath: fileURLToPath(import.meta.url),
    serialization: 'advanced',
    supportHandles: true
  } as const);

  // Create a TCP server
  console.log('\n📡 Creating TCP server on port 8888...');
  const server = net.createServer();

  await new Promise<void>((resolve) => {
    server.listen(8888, '127.0.0.1', () => {
      console.log('Server listening on 127.0.0.1:8888');
      resolve();
    });
  });

  // Set up server to accept connections
  let connectionId = 0;
  server.on('connection', async (socket) => {
    const id = `conn-${++connectionId}`;
    console.log(`\n🔗 New connection: ${id}`);

    try {
      // Transfer socket to child process
      console.log(`  [Parent] Transferring ${id} to child process...`);
      await handler.$sendHandle(socket, id);
      console.log(`  [Parent] Handle transferred successfully`);

      // Register the socket in child
      await handler.registerConnection(id, socket);
    } catch (error) {
      console.error(`  [Parent] Failed to transfer ${id}:`, error);
      socket.end();
    }
  });

  // Create test clients
  console.log('\n👤 Creating test clients...');

  // Client 1
  setTimeout(async () => {
    const client1 = net.connect(8888, '127.0.0.1', () => {
      console.log('\n👤 Client 1 connected');
      client1.write('Hello from client 1\n');
    });

    client1.on('data', (data) => {
      console.log('👤 Client 1 received:', data.toString().trim());
      client1.end();
    });
  }, 100);

  // Client 2
  setTimeout(async () => {
    const client2 = net.connect(8888, '127.0.0.1', () => {
      console.log('\n👤 Client 2 connected');
      client2.write('Hello from client 2\n');
    });

    client2.on('data', (data) => {
      console.log('👤 Client 2 received:', data.toString().trim());
      client2.end();
    });
  }, 200);

  // Wait for processing
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check connection count
  const count = await handler.getConnectionCount();
  console.log(`\n📊 Active connections in child: ${count}`);

  // Clean up
  console.log('\n🧹 Cleaning up...');
  await handler.closeAll();

  await new Promise<void>((resolve) => {
    server.close(() => {
      console.log('Server closed');
      resolve();
    });
  });

  console.log('\n✅ Socket transfer completed successfully!');
  console.log('\n💡 Key points:');
  console.log('   • Sockets are transferred via $sendHandle()');
  console.log('   • Child process receives actual socket handle');
  console.log('   • Both processes can interact with the socket');
  console.log('   • Unix/Linux only - not supported on Windows');
}

// Run the example
main().catch(console.error);

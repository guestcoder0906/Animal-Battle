
import Peer, { DataConnection } from 'peerjs';
import { GameAction, GameState } from '../types';

type ActionCallback = (action: GameAction) => void;

// Declare global window property for PeerJS to work with typescript without importing types everywhere
declare global {
  interface Window {
    peer: Peer;
    Peer: any;
  }
}

export class NetworkService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onAction: ActionCallback;
  public myId: string = '';

  constructor(onAction: ActionCallback) {
    this.onAction = onAction;
  }

  public setOnAction(cb: ActionCallback) {
    this.onAction = cb;
  }

  public async init(id?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clean up existing peer if re-initializing
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      // Timeout to prevent hanging indefinitely
      const timeout = setTimeout(() => {
          reject(new Error("Connection timed out. Please check your network/firewall."));
      }, 10000);

      try {
        // Fallback to global Peer if module import fails in specific bundlers/environments
        const PeerClass = (window as any).Peer || Peer;
        const peer = new PeerClass(id, {
          debug: 2
        });

        peer.on('open', (id) => {
          clearTimeout(timeout);
          console.log('My peer ID is: ' + id);
          this.myId = id;
          this.peer = peer;
          resolve(id);
        });

        peer.on('connection', (conn) => {
          console.log('Incoming connection...');
          this.handleConnection(conn);
        });

        peer.on('error', (err) => {
          console.error('Peer Error:', err);
          // Only reject the promise if we haven't initialized yet
          if (!this.peer) {
             clearTimeout(timeout);
             reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  public connect(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.peer) {
        reject('Peer not initialized');
        return;
      }
      
      // Use reliable: true to ensure game actions are delivered
      const conn = this.peer.connect(hostId, { reliable: true });
      this.handleConnection(conn);

      if (conn.open) {
        resolve();
        return;
      }

      conn.on('open', () => {
        resolve();
      });

      conn.on('error', (err) => {
        reject(err);
      });

      // Timeout if connection takes too long
      setTimeout(() => {
        if (!conn.open) {
          reject('Connection timed out');
        }
      }, 5000);
    });
  }

  private handleConnection(conn: DataConnection) {
    this.conn = conn;
    
    conn.on('open', () => {
      console.log('Connected to: ' + conn.peer);
    });

    conn.on('data', (data) => {
      console.log('Received data', data);
      if (this.onAction) {
          this.onAction(data as GameAction);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed');
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
    });
  }

  public send(action: GameAction) {
    if (this.conn && this.conn.open) {
      this.conn.send(action);
    } else {
      console.warn('No active connection to send action', action);
    }
  }
}

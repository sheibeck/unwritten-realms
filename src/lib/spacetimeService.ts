import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection, type ErrorContext } from '../module_bindings';

export class SpacetimeService {
  private connection: DbConnection | null = null;
  private identity: Identity | null = null;
  private connected = false;

  public moduleName: string;
  public uri: string;

  constructor(moduleName: string, uri: string = 'ws://localhost:3000') {
    this.moduleName = moduleName;
    this.uri = uri;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get currentIdentity(): Identity | null {
    return this.identity;
  }

  get conn(): DbConnection | null {
    return this.connection;
  }

  async connect(maxRetries: number = 20, intervalMs: number = 100): Promise<DbConnection | null> {
    return new Promise((resolve, reject) => {
      let attempts = 0;

      const tryConnect = () => {
        console.log(`Attempting connection to SpaceTimeDB (try ${attempts + 1}/${maxRetries})`);

        this.connection = DbConnection.builder()
          .withUri(this.uri)
          .withModuleName(this.moduleName)
          .withToken(localStorage.getItem('auth_token') || '')
          .onConnect((conn, identity, token) => {
            this.identity = identity;
            this.connected = true;
            localStorage.setItem('auth_token', token);
            console.log('Connected to SpaceTimeDB with identity:', identity.toHexString());

            conn.subscriptionBuilder()
              .onApplied(() => {
                console.log('SDK client cache initialized.');
              })
              .subscribe(['SELECT * FROM message', 'SELECT * FROM user']);

            resolve(this.connection);
          })
          .onDisconnect(() => {
            console.log('Disconnected from SpaceTimeDB');
            this.connected = false;
            this.identity = null;
          })
          .onConnectError((_ctx: ErrorContext, err: Error) => {
            console.error('Error connecting to SpaceTimeDB:', err);
            attempts++;
            if (attempts < maxRetries) {
              setTimeout(tryConnect, intervalMs);
            } else {
              console.error('Failed to connect after max retries.');
              reject(null);
            }
          })
          .build();
      };

      tryConnect();
    });
  }
}

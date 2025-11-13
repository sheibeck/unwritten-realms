import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection, type ErrorContext } from '@/spacetimedb/client';
import { fetchAuthSession } from '@aws-amplify/auth';

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
    return new Promise(async (resolve, reject) => {
      let attempts = 0;

      let idToken: string | undefined;
      try {
        const session = await fetchAuthSession();
        idToken = session.tokens?.idToken?.toString();

        if (!idToken) {
          throw new Error('Cognito idToken is missing.');
        }
      } catch (err) {
        console.error('Failed to get Cognito idToken:', err);
        reject(err);
        return;
      }

      const tryConnect = () => {
        console.debug(`Attempting connection to SpaceTimeDB (try ${attempts + 1}/${maxRetries})`);

        this.connection = DbConnection.builder()
          .withUri(this.uri)
          .withModuleName(this.moduleName)
          .withToken(idToken)  // ✅ pass the **signed JWT**
          .onConnect((conn, identity) => {
            this.identity = new Identity(identity.__identity__);
            this.connected = true;
            console.debug('Connected to SpaceTimeDB with identity:', identity.toHexString());

            conn.subscriptionBuilder()
              .onApplied(() => {
                console.debug('SDK client cache initialized.');
              })
              .subscribe(['SELECT * FROM character', 'SELECT * FROM user']);

            resolve(this.connection);
          })
          .onDisconnect(() => {
            console.debug('Disconnected from SpaceTimeDB');
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

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        console.debug('🔌 Disconnecting from SpaceTimeDB...');
        await this.connection.disconnect();  // <-- check if this exists in SDK
      } catch (err) {
        console.warn('⚠️ Error while disconnecting:', err);
      } finally {
        this.connection = null;
        this.identity = null;
        this.connected = false;
      }
    } else {
      console.debug('⚠️ No active SpaceTimeDB connection to disconnect.');
    }
  }
}

import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { DbConnection, type ErrorContext } from '../module_bindings';
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
        console.log(`Attempting connection to SpaceTimeDB (try ${attempts + 1}/${maxRetries})`);

        this.connection = DbConnection.builder()
          .withUri(this.uri)
          .withModuleName(this.moduleName)
          .withToken(idToken)  // ✅ pass the **signed JWT**
          .onConnect((conn, identity) => {
            this.identity = identity;
            this.connected = true;
            console.log('Connected to SpaceTimeDB with identity:', identity.toHexString());

            conn.subscriptionBuilder()
              .onApplied(() => {
                console.log('SDK client cache initialized.');
              })
              .subscribe(['SELECT * FROM character', 'SELECT * FROM user']);

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

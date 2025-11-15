import { registerUserReducers } from './spacetimedb/server/userReducers';
import { registerCharacterReducers } from './spacetimedb/server/characterReducers';
import { registerNpcReducers } from './spacetimedb/server/npcReducers';
import { registerQuestReducers } from './spacetimedb/server/questReducers';
import { registerRegionReducers } from './spacetimedb/server/regionReducers';
import { registerLifecycleHooks } from './spacetimedb/server/lifecycle';

// Register all reducers and hooks
registerUserReducers();
registerCharacterReducers();
registerNpcReducers();
registerQuestReducers();
registerRegionReducers();
registerLifecycleHooks();

using SpacetimeDB;

public static partial class Module
{
    [Reducer(ReducerKind.ClientConnected)]
    public static void ClientConnected(ReducerContext ctx)
    {
        Log.Info($"Connect {ctx.Sender}");
        var user = ctx.Db.user.UserId.Find(ctx.Sender);

        if (user is not null)
        {
            // If this is a returning user, i.e., we already have a `User` with this `Identity`,
            // set `Online: true`, but leave `Name` and `Identity` unchanged.
            user.Online = true;
            ctx.Db.user.UserId.Update(user);
        }
        else
        {
            // If this is a new user, create a `User` object for the `Identity`,
            // which is online, but hasn't set a name.
            ctx.Db.user.Insert(
                new User
                {
                    Name = null,
                    UserId = ctx.Sender,
                    Online = true,
                }
            );
        }
    }

    [Reducer(ReducerKind.ClientDisconnected)]
    public static void ClientDisconnected(ReducerContext ctx)
    {
        var user = ctx.Db.user.UserId.Find(ctx.Sender);

        if (user is not null)
        {
            // This user should exist, so set `Online: false`.
            user.Online = false;
            ctx.Db.user.UserId.Update(user);
        }
        else
        {
            // User does not exist, log warning
            Log.Warn("Warning: No user found for disconnected client.");
        }
    }


    [Reducer]
    public static void ClearUsers(ReducerContext ctx)
    {
        foreach (var user in ctx.Db.user.Iter())
        {
            ctx.Db.user.UserId.Delete(user.UserId);
        }
        Log.Info("All users cleared.");
    }

    [Reducer]
    public static void ClearCharacters(ReducerContext ctx)
    {
        foreach (var character in ctx.Db.character.Iter())
        {
            ctx.Db.character.CharacterId.Delete(character.CharacterId);
        }
        Log.Info("All characters cleared.");
    }

    [Reducer(ReducerKind.Init)]
    public static void Init(ReducerContext ctx)
    {
        // Run when the module is first loaded.
    }
}

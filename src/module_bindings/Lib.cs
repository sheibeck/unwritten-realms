using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "user", Public = true)]
    public partial class User
    {
        [PrimaryKey]
        public Identity Identity;
        public string? Name;
        public bool Online;
    }

    [Reducer]
    public static void SetName(ReducerContext ctx, string name)
    {
        name = ValidateName(name);

        var user = ctx.Db.user.Identity.Find(ctx.Sender);
        if (user is not null)
        {
            user.Name = name;
            ctx.Db.user.Identity.Update(user);
        }
    }

    [Reducer(ReducerKind.ClientConnected)]
    public static void ClientConnected(ReducerContext ctx)
    {
        Log.Info($"Connect {ctx.Sender}");
        var user = ctx.Db.user.Identity.Find(ctx.Sender);

        if (user is not null)
        {
            // If this is a returning user, i.e., we already have a `User` with this `Identity`,
            // set `Online: true`, but leave `Name` and `Identity` unchanged.
            user.Online = true;
            ctx.Db.user.Identity.Update(user);
        }
        else
        {
            // If this is a new user, create a `User` object for the `Identity`,
            // which is online, but hasn't set a name.
            ctx.Db.user.Insert(
                new User
                {
                    Name = null,
                    Identity = ctx.Sender,
                    Online = true,
                }
            );
        }
    }

    [Reducer(ReducerKind.ClientDisconnected)]
    public static void ClientDisconnected(ReducerContext ctx)
    {
        var user = ctx.Db.user.Identity.Find(ctx.Sender);

        if (user is not null)
        {
            // This user should exist, so set `Online: false`.
            user.Online = false;
            ctx.Db.user.Identity.Update(user);
        }
        else
        {
            // User does not exist, log warning
            Log.Warn("Warning: No user found for disconnected client.");
        }
    }

    private static string ValidateName(string name)
    {
        if (string.IsNullOrEmpty(name))
        {
            throw new Exception("Names must not be empty");
        }
        return name;
    }

    [Table(Name = "character", Public = true)]
    public partial struct Character
    {
        [Unique, PrimaryKey]
        public string CharacterId;
        public Identity User;
        public string Name;
        public string Race;
        public string profession;
        public string Specialization;
        public string StartingRegion;
        public string CreatedAt;
    }

    [Reducer]
    public static void AddCharacter(ReducerContext ctx, string name, string race, string profession, string specialization, string startingRegion)
    {
        var character = ctx.Db.character.Insert(new Character {
            CharacterId = Guid.NewGuid().ToString("N"),
            User = ctx.Sender,
            Name = name,
            Race = race,
            profession = profession,
            Specialization = specialization,
            StartingRegion = startingRegion,
            CreatedAt = DateTimeOffset.UtcNow.ToString("o")
        });

        Log.Info($"Inserted {character.Name} under #{character.CharacterId}");
    }

    [Reducer(ReducerKind.Init)]
    public static void Init(ReducerContext ctx)
    {
        // Run when the module is first loaded.
    }
}

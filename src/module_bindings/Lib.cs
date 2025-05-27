using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "user", Public = true)]
    public partial class User
    {
        [PrimaryKey]
        public Identity UserId;
        public string? Name;
        public bool Online;
    }

    [Reducer]
    public static void SetName(ReducerContext ctx, string name)
    {
        name = ValidateName(name);

        var user = ctx.Db.user.UserId.Find(ctx.Sender);
        if (user is not null)
        {
            user.Name = name;
            ctx.Db.user.UserId.Update(user);
        }
    }

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
        [Unique]
        public Identity UserId;

        [Unique, PrimaryKey]
        public string CharacterId;

        public string Name;
        public string Race;
        public string Profession;
        public string Specialization;
        public string StartingRegion;
        public string CreatedAt;

        // 📍 Current Location
        public string CurrentLocation;

        // 💪 Core Attributes
        public int Strength;
        public int Dexterity;
        public int Intelligence;
        public int Constitution;
        public int Wisdom;
        public int Willpower;
        public int Charisma;

        // ❤️ Health
        public int MaxHealth;
        public int CurrentHealth;

        // 🔮 Mana
        public int MaxMana;
        public int CurrentMana;

        // 🛡 Abilities (stored as JSON strings or comma-separated for simplicity)
        public string ClassAbilities;          // e.g., "Fireball, Arcane Shield"
        public string RaceAbilities;           // e.g., "Night Vision, Stone Endurance"
        public string SpecializationAbilities;// e.g., "Runescribe, Mana Surge"

        // 🎒 Inventory
        public string InventoryItems;         // e.g., JSON array or comma-separated: "[{\"item\":\"Health Potion\",\"qty\":3}]"

        // 🗡 Equipped Items (slots)
        public string Head;
        public string Shoulders;
        public string Back;
        public string Chest;
        public string Arms;
        public string Hands;
        public string Legs;
        public string Feet;
        public string Rings;
        public string Necklace;
        public string Earrings;
        public string Relic;
        public string PrimaryWeapon;
        public string SecondaryWeapon;
    }


    [Reducer]
    public static void AddCharacter(ReducerContext ctx, string name, string race, string profession, string specialization, string startingRegion)
    {
        var idIndex = ctx.Db.character.UserId;
        var existingUserCharacter = idIndex.Find(ctx.Sender);
        if (existingUserCharacter is not null)
        {
            Log.Info($"Inserted failed. User already has a character");
            throw new Exception("User already has a character.");
        }
        
        var character = ctx.Db.character.Insert(new Character {
            CharacterId = Guid.NewGuid().ToString("N"),
            UserId = ctx.Sender,
            Name = name,
            Race = race,
            Profession = profession,
            Specialization = specialization,
            StartingRegion = startingRegion,
            CurrentLocation = startingRegion,
            CreatedAt = DateTimeOffset.UtcNow.ToString("o")
        });

        Log.Info($"Inserted {character.Name} for userId {ctx.Sender}");
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

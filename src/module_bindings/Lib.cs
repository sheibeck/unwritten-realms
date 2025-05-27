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
        public int? Strength;
        public int? Dexterity;
        public int? Intelligence;
        public int? Constitution;
        public int? Wisdom;
        public int? Willpower;
        public int? Charisma;

        // ❤️ Health
        public int? MaxHealth;
        public int? CurrentHealth;

        // 🔮 Mana
        public int? MaxMana;
        public int? CurrentMana;

        // 🛡 Abilities (stored as JSON strings or comma-separated for simplicity)
        public string? ClassAbilities;          // e.g., "Fireball, Arcane Shield"
        public string? RaceAbilities;           // e.g., "Night Vision, Stone Endurance"
        public string? SpecializationAbilities;// e.g., "Runescribe, Mana Surge"

        public int? Level;
        public int? XP;

        // 🎒 Inventory
        public string? InventoryItems;         // e.g., JSON array or comma-separated: "[{\"item\":\"Health Potion\",\"qty\":3}]"

        // 🗡 Equipped Items (slots)
        public string? Head;
        public string? Shoulders;
        public string? Back;
        public string? Chest;
        public string? Arms;
        public string? Hands;
        public string? Legs;
        public string? Feet;
        public string? Rings;
        public string? Necklace;
        public string? Earrings;
        public string? Relic;
        public string? PrimaryWeapon;
        public string? SecondaryWeapon;
    }

    [Type]
    public partial struct UpdateCharacterInput
    {
        public string CharacterId;

        public string? Name;
        public string? CurrentLocation;

        public int? Strength;
        public int? Dexterity;
        public int? Intelligence;
        public int? Constitution;
        public int? Wisdom;
        public int? Willpower;
        public int? Charisma;

        public int? MaxHealth;
        public int? CurrentHealth;

        public int? MaxMana;
        public int? CurrentMana;

        public string? ClassAbilities;
        public string? RaceAbilities;
        public string? SpecializationAbilities;

        public int? Level;
        public int? XP;

        public string? InventoryItems;

        public string? Head;
        public string? Shoulders;
        public string? Back;
        public string? Chest;
        public string? Arms;
        public string? Hands;
        public string? Legs;
        public string? Feet;
        public string? Rings;
        public string? Necklace;
        public string? Earrings;
        public string? Relic;
        public string? PrimaryWeapon;
        public string? SecondaryWeapon;
    }

    [Reducer]
    public static void UpdateCharacter(ReducerContext ctx, UpdateCharacterInput input)
    {
        var maybeCharacter = ctx.Db.character.CharacterId.Find(input.CharacterId);

        if (maybeCharacter is not Module.Character character)
        {
            Log.Warn($"Update failed. Character not found: {input.CharacterId}");
            throw new Exception("Character not found.");
        }

        if (character.UserId != ctx.Sender)
        {
            Log.Warn($"Unauthorized update attempt by {ctx.Sender} on {input.CharacterId}");
            throw new Exception("You do not have permission to update this character.");
        }

        // Now safe to access fields like character.Wisdom, character.Name, etc.

        if (input.Name != null) character.Name = input.Name;
        if (input.CurrentLocation != null) character.CurrentLocation = input.CurrentLocation;

        if (input.Strength.HasValue) character.Strength = input.Strength;
        if (input.Dexterity.HasValue) character.Dexterity = input.Dexterity;
        if (input.Intelligence.HasValue) character.Intelligence = input.Intelligence;
        if (input.Constitution.HasValue) character.Constitution = input.Constitution;
        if (input.Wisdom.HasValue) character.Wisdom = input.Wisdom;
        if (input.Willpower.HasValue) character.Willpower = input.Willpower;
        if (input.Charisma.HasValue) character.Charisma = input.Charisma;

        if (input.MaxHealth.HasValue) character.MaxHealth = input.MaxHealth;
        if (input.CurrentHealth.HasValue) character.CurrentHealth = input.CurrentHealth;

        if (input.MaxMana.HasValue) character.MaxMana = input.MaxMana;
        if (input.CurrentMana.HasValue) character.CurrentMana = input.CurrentMana;

        if (input.ClassAbilities != null) character.ClassAbilities = input.ClassAbilities;
        if (input.RaceAbilities != null) character.RaceAbilities = input.RaceAbilities;
        if (input.SpecializationAbilities != null) character.SpecializationAbilities = input.SpecializationAbilities;

        if (input.Level.HasValue) character.Level = input.Level;
        if (input.XP.HasValue) character.XP = input.XP;

        if (input.InventoryItems != null) character.InventoryItems = input.InventoryItems;

        if (input.Head != null) character.Head = input.Head;
        if (input.Shoulders != null) character.Shoulders = input.Shoulders;
        if (input.Back != null) character.Back = input.Back;
        if (input.Chest != null) character.Chest = input.Chest;
        if (input.Arms != null) character.Arms = input.Arms;
        if (input.Hands != null) character.Hands = input.Hands;
        if (input.Legs != null) character.Legs = input.Legs;
        if (input.Feet != null) character.Feet = input.Feet;
        if (input.Rings != null) character.Rings = input.Rings;
        if (input.Necklace != null) character.Necklace = input.Necklace;
        if (input.Earrings != null) character.Earrings = input.Earrings;
        if (input.Relic != null) character.Relic = input.Relic;
        if (input.PrimaryWeapon != null) character.PrimaryWeapon = input.PrimaryWeapon;
        if (input.SecondaryWeapon != null) character.SecondaryWeapon = input.SecondaryWeapon;

        ctx.Db.character.CharacterId.Update(character);
        Log.Info($"Updated character {character.CharacterId} by user {ctx.Sender}");
    }


    [Type]
    public partial struct AddCharacterInput
    {
        public string Name;
        public string Race;
        public string Profession;
        public string Specialization;
        public string StartingRegion;
        public int Strength;
        public int Dexterity;
        public int Intelligence;
        public int Constitution;
        public int Wisdom;
        public int Willpower;
        public int Charisma;
        public int MaxHealth;
        public int CurrentHealth;
        public int MaxMana;
        public int CurrentMana;
        public string ClassAbilities;
        public string RaceAbilities;
        public string SpecializationAbilities;
        public int Level;
        public int XP;
        public string PrimaryWeapon;
        public string SecondaryWeapon;
    }

    [Reducer]
    public static void AddCharacter(ReducerContext ctx, AddCharacterInput inputCharacter)
    {
        var idIndex = ctx.Db.character.UserId;
        var existingUserCharacter = idIndex.Find(ctx.Sender);
        if (existingUserCharacter is not null)
        {
            Log.Info($"Insert failed. User already has a character");
            throw new Exception("User already has a character.");
        }

        var character = ctx.Db.character.Insert(new Character
        {
            CharacterId = Guid.NewGuid().ToString("N"),
            UserId = ctx.Sender,
            Name = inputCharacter.Name,
            Race = inputCharacter.Race,
            Profession = inputCharacter.Profession,
            Specialization = inputCharacter.Specialization,
            StartingRegion = inputCharacter.StartingRegion,
            CurrentLocation = inputCharacter.StartingRegion,
            CreatedAt = DateTimeOffset.UtcNow.ToString("o"),

            // Optional or additional fields
            Strength = inputCharacter.Strength,
            Dexterity = inputCharacter.Dexterity,
            Intelligence = inputCharacter.Intelligence,
            Constitution = inputCharacter.Constitution,
            Wisdom = inputCharacter.Wisdom,
            Willpower = inputCharacter.Willpower,
            Charisma = inputCharacter.Charisma,

            MaxHealth = inputCharacter.MaxHealth,
            CurrentHealth = inputCharacter.CurrentHealth,

            MaxMana = inputCharacter.MaxMana,
            CurrentMana = inputCharacter.CurrentMana,

            ClassAbilities = inputCharacter.ClassAbilities,
            RaceAbilities = inputCharacter.RaceAbilities,
            SpecializationAbilities = inputCharacter.SpecializationAbilities,

            // InventoryItems = inputCharacter.InventoryItems,

            // Head = inputCharacter.Head,
            // Shoulders = inputCharacter.Shoulders,
            // Back = inputCharacter.Back,
            // Chest = inputCharacter.Chest,
            // Arms = inputCharacter.Arms,
            // Hands = inputCharacter.Hands,
            // Legs = inputCharacter.Legs,
            // Feet = inputCharacter.Feet,
            // Rings = inputCharacter.Rings,
            // Necklace = inputCharacter.Necklace,
            // Earrings = inputCharacter.Earrings,
            // Relic = inputCharacter.Relic,
            PrimaryWeapon = inputCharacter.PrimaryWeapon,
            SecondaryWeapon = inputCharacter.SecondaryWeapon,

            Level = 1,
            XP = 0,
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

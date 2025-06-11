using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "character", Public = true)]
    public partial struct Character
    {
        [Unique]
        public Identity UserId;

        [Unique, PrimaryKey]
        public string CharacterId;

        public string Name;
        public string Description;
        public string Race;
        public string Archetype;
        public string Profession;
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
        public int? Charisma;

        // ❤️ Health
        public int? MaxHealth;
        public int? CurrentHealth;

        // 🔮 Mana
        public int? MaxMana;
        public int? CurrentMana;

        // 🛡 Abilities
        public string? RaceAbilities;
        public string? ProfessionAbilities;
        public string? ArmorType;

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
        public string? EquippedWeapon;

        public List<CharacterQuest>? Quests;
    }

    [Type]
    public partial struct UpdateCharacterInput
    {
        public string CharacterId;

        public string? Name;
        public string? Description;
        public string? CurrentLocation;

        public int? Strength;
        public int? Dexterity;
        public int? Intelligence;
        public int? Constitution;
        public int? Wisdom;
        public int? Charisma;

        public int? MaxHealth;
        public int? CurrentHealth;

        public int? MaxMana;
        public int? CurrentMana;

        public string? RaceAbilities;
        public string? ProfessionAbilities;
        public string? ArmorType;

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
        public string? EquippedWeapon;

        public List<CharacterQuest>? Quests;
    }

    [Reducer]
    public static void UpdateCharacter(ReducerContext ctx, UpdateCharacterInput input)
    {
        var maybeCharacter = ctx.Db.character.CharacterId.Find(input.CharacterId);

        if (maybeCharacter is not Module.Character character)
        {
            Log.Warn($"Update failed. Character not found: {input.CharacterId}");
            throw new Exception($"Character not found: {input.CharacterId}");
        }

        if (character.UserId != ctx.Sender)
        {
            Log.Warn($"Unauthorized update attempt by {ctx.Sender} on {input.CharacterId}");
            throw new Exception("You do not have permission to update this character.");
        }

        // Now safe to access fields like character.Wisdom, character.Name, etc.

        if (input.Name != null) character.Name = input.Name;
        if (input.Description != null) character.Description = input.Description;
        if (input.CurrentLocation != null) character.CurrentLocation = input.CurrentLocation;

        if (input.Strength.HasValue) character.Strength = input.Strength;
        if (input.Dexterity.HasValue) character.Dexterity = input.Dexterity;
        if (input.Intelligence.HasValue) character.Intelligence = input.Intelligence;
        if (input.Constitution.HasValue) character.Constitution = input.Constitution;
        if (input.Wisdom.HasValue) character.Wisdom = input.Wisdom;
        if (input.Charisma.HasValue) character.Charisma = input.Charisma;

        if (input.MaxHealth.HasValue) character.MaxHealth = input.MaxHealth;
        if (input.CurrentHealth.HasValue) character.CurrentHealth = input.CurrentHealth;

        if (input.MaxMana.HasValue) character.MaxMana = input.MaxMana;
        if (input.CurrentMana.HasValue) character.CurrentMana = input.CurrentMana;

        if (input.RaceAbilities != null) character.RaceAbilities = input.RaceAbilities;
        if (input.ProfessionAbilities != null) character.ProfessionAbilities = input.ProfessionAbilities;

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
        if (input.EquippedWeapon != null) character.EquippedWeapon = input.EquippedWeapon;

        if (input.Quests != null)
        {
            if(character.Quests == null) {
                character.Quests = new List<CharacterQuest>();
            }

            foreach (var quest in input.Quests)
            {
                bool alreadyExists = character.Quests.Any(q => q.QuestId == quest.QuestId);
                 if (!alreadyExists)
                    character.Quests.Add(quest);
                }
            }
        }

        ctx.Db.character.CharacterId.Update(character);
        Log.Info($"Updated character {character.CharacterId} by user {ctx.Sender}");
    }

    [Type]
    public partial struct AddCharacterInput
    {
        public string Name;
        public string Description;
        public string Race;
        public string Archetype;
        public string Profession;
        public string StartingRegion;
        public int Strength;
        public int Dexterity;
        public int Intelligence;
        public int Constitution;
        public int Wisdom;
        public int Charisma;
        public int MaxHealth;
        public int CurrentHealth;
        public int MaxMana;
        public int CurrentMana;
        public string RaceAbilities;
        public string ProfessionAbilities;
        public int Level;
        public int XP;
        public string EquippedWeapon;
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
            Description = inputCharacter.Description,
            Race = inputCharacter.Race,
            Archetype = inputCharacter.Archetype,
            Profession = inputCharacter.Profession,
            StartingRegion = inputCharacter.StartingRegion,
            CurrentLocation = inputCharacter.StartingRegion,
            CreatedAt = DateTimeOffset.UtcNow.ToString("o"),

            // Optional or additional fields
            Strength = inputCharacter.Strength,
            Dexterity = inputCharacter.Dexterity,
            Intelligence = inputCharacter.Intelligence,
            Constitution = inputCharacter.Constitution,
            Wisdom = inputCharacter.Wisdom,
            Charisma = inputCharacter.Charisma,

            MaxHealth = inputCharacter.MaxHealth,
            CurrentHealth = inputCharacter.CurrentHealth,

            MaxMana = inputCharacter.MaxMana,
            CurrentMana = inputCharacter.CurrentMana,

            RaceAbilities = inputCharacter.RaceAbilities,
            ProfessionAbilities = inputCharacter.ProfessionAbilities,

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
            EquippedWeapon = inputCharacter.EquippedWeapon,

            Level = 1,
            XP = 0,

            Quests = new List<CharacterQuest>(),
        });

        Log.Info($"Inserted {character.Name} for userId {ctx.Sender}");
    }

    [Type]
    public partial struct CharacterQuest 
    {
        public string QuestId;
        public int Step;
        public string Status;
    }
}

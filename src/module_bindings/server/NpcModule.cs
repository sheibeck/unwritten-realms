using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "npc", Public = true)]
    public partial struct Npc
    {
        [Unique, PrimaryKey]
        public string NpcId;

        public string Name;
        public string Description;
        public string Race;
        public string Profession;

        public int MaxHealth;
        public int CurrentHealth;
        public int MaxMana;
        public int CurrentMana;

        public string Abilities; // Stored as a JSON string or comma-separated string
    }

    [Type]
    public partial struct CreateNpcInput
    {
        public string Name;
        public string Description;
        public string Race;
        public string Profession;

        public int MaxHealth;
        public int CurrentHealth;
        public int MaxMana;
        public int CurrentMana;

        public string Abilities;
    }

    [Reducer]
    public static void CreateNpc(ReducerContext ctx, CreateNpcInput input)
    {
        var npc = ctx.Db.npc.Insert(new Npc
        {
            NpcId = Guid.NewGuid().ToString("N"),
            Name = input.Name,
            Description = input.Description,
            Race = input.Race,
            Profession = input.Profession,
            MaxHealth = input.MaxHealth,
            CurrentHealth = input.CurrentHealth,
            MaxMana = input.MaxMana,
            CurrentMana = input.CurrentMana,
            Abilities = input.Abilities
        });

        Log.Info($"[CreateNpc] Created NPC: {npc.Name} ({npc.NpcId})");
    }
}

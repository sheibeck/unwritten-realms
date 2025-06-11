using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "quest", Public = true)]
    public partial struct Quest 
    {
        [Unique, PrimaryKey]
        public string QuestId;
        public string NpcId;
        public string Name;
        public string Description;
        public int Steps;
        public string Reward;
        public string Penalty;
        public string Type;
        public bool Repeatable;
    }

    [Type]
    public partial struct AddQuestInput
    {
        public string NpcId;
        public string Name;
        public string Description;
        public int Steps;
        public string Reward;
        public string Penalty;
        public string Type;
        public bool Repeatable;
    }

    [Reducer]
    public static void AddQuest(ReducerContext ctx, AddQuestInput inputQuest)
    {
        var quest = ctx.Db.quest.Insert(new Quest
        {
            QuestId = Guid.NewGuid().ToString("N"),
            NpcId = inputQuest.NpcId,
            Name = inputQuest.Name,
            Description = inputQuest.Description,
            Steps = inputQuest.Steps,
            Reward = inputQuest.Reward,
            Penalty = inputQuest.Penalty,
            Type = inputQuest.Type,
            Repeatable = inputQuest.Repeatable,
        });
    }
}
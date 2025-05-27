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

    
    private static string ValidateName(string name)
    {
        if (string.IsNullOrEmpty(name))
        {
            throw new Exception("Names must not be empty");
        }
        return name;
    }
}

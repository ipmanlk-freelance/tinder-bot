import discordJs from "discord.js";
import { getCommands } from "./command_loader";
import { parseYAML } from "./util/parse";
import { checkMemberHasPermission } from "./util/permissions";
import { reactionRole } from "./non_commands/reaction_role/reaction_role";
import { deleteIfExists } from "./data";
const config = parseYAML(`${__dirname}/../setup/config.yaml`);
process.env.BOT = config;

const commands = getCommands();

const client = new discordJs.Client();

client.on("ready", () => {
	console.log(`Logged in as ${client.user?.tag}!`);
	reactionRole.init(client);
	client.user?.setPresence({
		activity: { name: config["ACTIVITY NAME"], type: config["ACTIVITY TYPE"] },
		status: config["STATUS"],
	});
});

client.on("message", async (msg) => {
	if (msg.author.bot || !msg.content.startsWith(config.PREFIX)) return;

	const commandName =
		(msg.content.split(config.PREFIX)[1] || "").split(" ")[0] || "".trim();
	const command = commands.find((cmd) => cmd.name == commandName);

	if (!command) return;

	try {
		// non-dm command handling
		if (msg.member) {
			const commandConfig = parseYAML(command.config);
			const issAllowed = checkMemberHasPermission(
				msg.member,
				commandConfig["ALLOWED ROLES"]
			);
			if (issAllowed) {
				const handler = await import(command.handler);
				handler.handle(msg);
			} else {
				msg
					.reply({
						embed: {
							color: config.COLORS.FAILURE,
							description: "You don't have permission to run this command.",
						},
					})
					.then((m) => m.delete({ timeout: 5000 }));
				msg.react("🛑");
				msg.delete({ timeout: 5000 });
			}
		}
	} catch (e) {
		console.log(e);
	}
});

client.on("channelDelete", (channel) => {
	deleteIfExists(channel.id);
});

client.login(config.TOKEN);
